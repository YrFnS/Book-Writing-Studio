import assert from "assert";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const COOKIE_NAME = "bws_session";
const SESSION_DAYS = 30;

const username = () => process.env.AUTH_USERNAME || "";
const password = () => process.env.AUTH_PASSWORD || "";

// ponytail: no third env var to forget — the session key is derived from the
// password, so rotating the password also invalidates every live session.
const secret = () =>
  process.env.SESSION_SECRET || `bws:${username()}:${password()}`;

/** Auth is only enforced once both credentials are configured. */
export const isAuthConfigured = () => Boolean(username() && password());

const sign = (value: string) =>
  crypto.createHmac("sha256", secret()).update(value).digest("base64url");

const safeEqual = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Length differences leak through timingSafeEqual's own length check, so
  // compare digests of equal size instead of the raw values.
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(ab).digest(),
    crypto.createHash("sha256").update(bb).digest()
  );
};

const readCookie = (req: Request): string | null => {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }
  return null;
};

export const hasValidSession = (req: Request): boolean => {
  if (!isAuthConfigured()) return true;
  const raw = readCookie(req);
  if (!raw) return false;
  const [issuedAt, signature] = raw.split(".");
  if (!issuedAt || !signature) return false;
  if (!safeEqual(signature, sign(issuedAt))) return false;
  const age = Date.now() - Number(issuedAt);
  return Number.isFinite(age) && age >= 0 && age < SESSION_DAYS * 864e5;
};

const cookieOptions = (req: Request) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  maxAge: SESSION_DAYS * 864e5,
  path: "/",
});

export const handleLogin = (req: Request, res: Response) => {
  if (!isAuthConfigured()) {
    return res.json({ success: true, configured: false });
  }
  const user = String(req.body?.username || "").trim();
  const pass = String(req.body?.password || "");
  const ok =
    safeEqual(user.toLowerCase(), username().trim().toLowerCase()) &&
    safeEqual(pass, password());

  if (!ok) {
    return res.status(401).json({ success: false, error: "Invalid username or password." });
  }

  const issuedAt = String(Date.now());
  res.cookie(COOKIE_NAME, `${issuedAt}.${sign(issuedAt)}`, cookieOptions(req));
  return res.json({ success: true, configured: true });
};

export const handleLogout = (req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(req), maxAge: undefined });
  return res.json({ success: true });
};

export const handleSession = (req: Request, res: Response) =>
  res.json({ configured: isAuthConfigured(), authenticated: hasValidSession(req) });

/** Gate for routes that spend the deployment's own Gemini quota. */
export const requireSession = (req: Request, res: Response, next: NextFunction) => {
  if (hasValidSession(req)) return next();
  return res.status(401).json({ error: "Not signed in.", needsAuth: true });
};

export function demo() {
  process.env.AUTH_USERNAME = "author";
  process.env.AUTH_PASSWORD = "s3cret";
  const req = (cookie?: string) => ({ headers: cookie ? { cookie } : {} }) as Request;

  assert.ok(isAuthConfigured(), "configured with both vars set");
  assert.ok(!hasValidSession(req()), "no cookie -> rejected");

  const issuedAt = String(Date.now());
  const good = `${COOKIE_NAME}=${issuedAt}.${sign(issuedAt)}`;
  assert.ok(hasValidSession(req(good)), "valid signature accepted");
  assert.ok(!hasValidSession(req(`${COOKIE_NAME}=${issuedAt}.tampered`)), "bad signature rejected");

  const old = String(Date.now() - (SESSION_DAYS + 1) * 864e5);
  assert.ok(!hasValidSession(req(`${COOKIE_NAME}=${old}.${sign(old)}`)), "expired session rejected");

  process.env.AUTH_PASSWORD = "rotated";
  assert.ok(!hasValidSession(req(good)), "rotating the password kills live sessions");

  delete process.env.AUTH_USERNAME;
  delete process.env.AUTH_PASSWORD;
  assert.ok(hasValidSession(req()), "unconfigured -> open (local dev)");
  console.log("auth-server demo: all checks passed");
}
