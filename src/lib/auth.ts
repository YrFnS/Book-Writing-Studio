// Studio lock. Credentials live in the deployment's env vars and are verified
// server-side; the browser only ever holds an HttpOnly session cookie.

export interface SessionState {
  /** False when the deployment has no credentials set — studio stays open. */
  configured: boolean;
  authenticated: boolean;
}

export async function fetchSession(): Promise<SessionState> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    // ponytail: an unreachable API means we cannot prove the studio is open,
    // so lock it rather than fail open.
    return { configured: true, authenticated: false };
  }
}

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Invalid username or password.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach the server. Check your connection.' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Clearing the cookie is best-effort; the lock screen shows either way.
  }
}
