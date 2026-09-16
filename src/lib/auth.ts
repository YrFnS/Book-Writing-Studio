// Client-side authentication storage and verification helper
export interface AuthorAuth {
  username: string;
  passHash: string; // simple hash or stored secret
  isConfigured: boolean;
}

const AUTH_STORAGE_KEY = 'novel_studio_author_auth';
const LOCK_STATE_KEY = 'novel_studio_locked';

export function getEnvAuth() {
  const env = (import.meta as any).env;
  const envUser = env?.VITE_AUTH_USERNAME;
  const envPass = env?.VITE_AUTH_PASSWORD;
  if (envUser && envPass) {
    return { username: envUser, passHash: envPass, isConfigured: true, isEnvLocked: true };
  }
  return null;
}

export function getStoredAuth(): AuthorAuth {
  const env = getEnvAuth();
  if (env) return env;

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading auth', e);
  }
  return {
    username: 'author',
    passHash: 'writer2026',
    isConfigured: false,
  };
}

export function saveAuth(username: string, pass: string): void {
  const env = getEnvAuth();
  if (env) return; // Cannot override env auth in client if set via deployment env

  const auth: AuthorAuth = {
    username: username.trim() || 'author',
    passHash: pass,
    isConfigured: true,
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  localStorage.removeItem(LOCK_STATE_KEY);
}

export function verifyCredentials(username: string, pass: string): boolean {
  const auth = getStoredAuth();
  return auth.username.toLowerCase() === username.toLowerCase().trim() && auth.passHash === pass;
}

export function isStudioLocked(): boolean {
  const env = getEnvAuth();
  if (env) {
    return localStorage.getItem(LOCK_STATE_KEY) !== 'false'; // Locked by default if env auth is set
  }
  const auth = getStoredAuth();
  if (!auth.isConfigured) return true; // Require auth/setup on first load
  return localStorage.getItem(LOCK_STATE_KEY) === 'true';
}

export function lockStudio(): void {
  localStorage.setItem(LOCK_STATE_KEY, 'true');
}

export function unlockStudio(): void {
  localStorage.removeItem(LOCK_STATE_KEY);
}
