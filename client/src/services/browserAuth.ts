import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { StoredSession } from './session';
import { GATEWAY_BASE_URL } from '../config/gateway';

type LoginResponse = { accessToken: string; expiresIn?: number; userId?: string; profilePictureUrl?: string };

const SESSION_KEY = 'teddy-bud:browser-session';
const NATIVE_SESSION_SERVICE = 'com.teddybud.account-auth';
const NATIVE_SETUP_SERVICE = 'com.teddybud.auth-setup';
const SETUP_KEY = 'setup-complete';
let inMemorySession: StoredSession | null = null;

function sessionStore(): Storage | null {
  return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
}

function desktopBridge() {
  return typeof window !== 'undefined' ? window.teddyBudDesktop : undefined;
}

function expiresAt(token: string, expiresIn: number) {
  try {
    const payload = token.split('.')[1];
    if (!payload) throw new Error('JWT payload is missing.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const exp = JSON.parse(atob(normalized)).exp;
    return typeof exp === 'number' ? exp * 1000 : Date.now() + expiresIn * 1000;
  } catch {
    return Date.now() + expiresIn * 1000;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message ?? payload?.error ?? payload?.message;
      const error = Object.assign(
        new Error(
          response.status === 404 && path.startsWith('/auth/')
            ? 'The browser sign-in endpoint is unavailable. Please contact the app administrator.'
            : typeof message === 'string'
              ? message
              : `Request failed (${response.status}).`,
        ),
        { status: response.status },
      );
      throw error;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The sign-in request timed out. Check your internet connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class BrowserAuthService {
  private async readStoredSession(): Promise<StoredSession | null> {
    let saved: string | null;
    if (Platform.OS === 'web') {
      saved = desktopBridge()
        ? await desktopBridge()!.loadSession()
        : sessionStore()?.getItem(SESSION_KEY) ?? null;
    } else {
      const credentials = await Keychain.getGenericPassword({ service: NATIVE_SESSION_SERVICE });
      saved = credentials && typeof credentials !== 'boolean' ? credentials.password : null;
    }
    if (!saved) return null;
    try {
      const session: unknown = JSON.parse(saved);
      if (!session || typeof session !== 'object' || !('accessToken' in session) || typeof session.accessToken !== 'string' || !('expiresAt' in session) || typeof session.expiresAt !== 'number') {
        throw new Error('Session is malformed.');
      }
      return session as StoredSession;
    } catch {
      await this.clear();
      return null;
    }
  }

  private hasActiveLegacySession(token: string): boolean {
    try {
      const payload = token.split('.')[1];
      if (!payload) return false;
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const claims = JSON.parse(atob(normalized));
      return claims.kind === 'google-user' && typeof claims.rfe === 'number' && claims.rfe * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  async canMigrateLegacyAccount(): Promise<boolean> {
    const saved = inMemorySession ?? await this.readStoredSession();
    return Boolean(saved && this.hasActiveLegacySession(saved.accessToken));
  }

  async migrateLegacyAccount(password: string, recoveryKey: string): Promise<StoredSession> {
    const saved = inMemorySession ?? await this.readStoredSession();
    if (!saved || !this.hasActiveLegacySession(saved.accessToken)) {
      throw Object.assign(new Error('This device no longer has an active account session to move.'), { status: 401 });
    }
    const result = await request<LoginResponse>('/auth/migrate-legacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${saved.accessToken}` },
      body: JSON.stringify({ password, recoveryKey }),
    });
    await this.markSetupComplete();
    return this.save(result);
  }

  async shouldCreateAccount(): Promise<boolean> {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(SETUP_KEY) !== 'true'; } catch { return true; }
    }
    const setup = await Keychain.getGenericPassword({ service: NATIVE_SETUP_SERVICE });
    return !setup;
  }

  async markSetupComplete(): Promise<void> {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(SETUP_KEY, 'true'); } catch { /* Sign-in still works if storage is unavailable. */ }
      return;
    }
    await Keychain.setGenericPassword('setup', 'true', {
      service: NATIVE_SETUP_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async signIn(email: string, password: string): Promise<StoredSession> {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    await this.markSetupComplete();
    return this.save(result);
  }

  async createAccount(email: string, password: string, recoveryKey: string): Promise<StoredSession> {
    const result = await request<LoginResponse>('/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, recoveryKey }),
    });
    await this.markSetupComplete();
    return this.save(result);
  }

  async recoverPassword(email: string, recoveryKey: string, newPassword: string): Promise<void> {
    await request<{ success: boolean }>('/auth/recover', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, recoveryKey, newPassword }),
    });
  }

  async restore(): Promise<StoredSession | null> {
    const current = inMemorySession ?? await this.readStoredSession();
    if (!current) return null;
    inMemorySession = current;
    if (current.expiresAt <= Date.now()) {
      try {
        return await this.refresh();
      } catch (error) {
        if ((error as { status?: number }).status === 401) return null;
        throw error;
      }
    }
    try {
      await request<{ userId: string }>('/auth/session', {
        method: 'GET', headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      return current;
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        if (this.hasActiveLegacySession(current.accessToken)) return null;
        await this.clear();
        return null;
      }
      throw error;
    }
  }

  async refresh(): Promise<StoredSession> {
    const current = inMemorySession ?? await this.readStoredSession();
    if (!current) throw Object.assign(new Error('Your session has ended. Please log in again.'), { status: 401 });
    if (!this.hasActiveLegacySession(current.accessToken)) await this.clear();
    throw Object.assign(new Error('Your one-hour session has expired. Please sign in again.'), { status: 401 });
  }

  async logout(): Promise<void> {
    const current = inMemorySession ?? await this.readStoredSession();
    try {
      if (current) {
        await request<{ success: boolean }>('/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.accessToken}` },
        });
      }
    } finally {
      await this.clear();
    }
  }

  async clear() {
    inMemorySession = null;
    if (Platform.OS === 'web') {
      if (desktopBridge()) await desktopBridge()!.clearSession();
      else sessionStore()?.removeItem(SESSION_KEY);
    } else {
      await Keychain.resetGenericPassword({ service: NATIVE_SESSION_SERVICE });
    }
  }

  private async save(response: LoginResponse): Promise<StoredSession> {
    if (!response.accessToken) throw new Error('The gateway did not return an access token.');
    const session = { accessToken: response.accessToken, expiresAt: expiresAt(response.accessToken, response.expiresIn ?? 3600), ...(response.profilePictureUrl ? { profilePictureUrl: response.profilePictureUrl } : {}) };
    if (Platform.OS === 'web') {
      if (desktopBridge()) await desktopBridge()!.saveSession(JSON.stringify(session));
      else sessionStore()?.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      const saved = await Keychain.setGenericPassword('session', JSON.stringify(session), { service: NATIVE_SESSION_SERVICE });
      if (!saved) throw new Error('Could not save your secure sign-in session.');
    }
    inMemorySession = session;
    return session;
  }
}

export const browserAuthService = new BrowserAuthService();
