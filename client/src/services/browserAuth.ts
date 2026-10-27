import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { StoredSession } from './session';
import { authContextForPath, authErrorMessage, authServiceErrorFromResponse, AuthServiceError } from './authErrors';
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
  const context = authContextForPath(path);
  try {
    let response: Response;
    try {
      response = await fetch(`${GATEWAY_BASE_URL}${path}`, { ...init, signal: controller.signal });
    } catch (requestError) {
      if (controller.signal.aborted || (requestError instanceof Error && requestError.name === 'AbortError')) {
        throw new AuthServiceError('The request took too long. Check your connection and try again.', 'timeout', 408);
      }
      throw new AuthServiceError(authErrorMessage(requestError, context), 'network');
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw authServiceErrorFromResponse(response.status, context);
    if (payload === null) {
      throw new AuthServiceError('The account service returned an unreadable response. Please try again.', 'unexpected', response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof AuthServiceError) throw error;
    const status = error && typeof error === 'object' && 'status' in error
      && typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : undefined;
    throw new AuthServiceError(authErrorMessage(error, context), 'unexpected', status);
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
    try {
      const saved = await Keychain.setGenericPassword('setup', 'true', {
        service: NATIVE_SETUP_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (!saved) throw new Error('Secure setup storage rejected the value.');
    } catch {
      throw new AuthServiceError(
        'Teddy Bud could not save the account setup securely on this device. Check device storage and try again. Your saved chats have not been deleted.',
        'storage',
      );
    }
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
        if ((error as { status?: number }).status === 401) {
          throw authServiceErrorFromResponse(401, 'session-restore');
        }
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
        throw authServiceErrorFromResponse(401, 'session-restore');
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
    try {
      if (Platform.OS === 'web') {
        if (desktopBridge()) await desktopBridge()!.clearSession();
        else sessionStore()?.removeItem(SESSION_KEY);
      } else {
        await Keychain.resetGenericPassword({ service: NATIVE_SESSION_SERVICE });
      }
    } catch {
      throw new AuthServiceError(
        'Teddy Bud could not remove the saved sign-in details from this device. Retry sign-out before sharing this device.',
        'storage',
      );
    }
  }

  private async save(response: LoginResponse): Promise<StoredSession> {
    if (!response.accessToken) {
      throw new AuthServiceError('The account service did not complete sign-in. Please try again.', 'unexpected');
    }
    const session = {
      accessToken: response.accessToken,
      expiresAt: expiresAt(response.accessToken, response.expiresIn ?? 3600),
      ...(response.profilePictureUrl ? { profilePictureUrl: response.profilePictureUrl } : {}),
    };
    try {
      if (Platform.OS === 'web') {
        if (desktopBridge()) await desktopBridge()!.saveSession(JSON.stringify(session));
        else {
          const storage = sessionStore();
          if (!storage) throw new Error('Session storage is unavailable.');
          storage.setItem(SESSION_KEY, JSON.stringify(session));
        }
      } else {
        const saved = await Keychain.setGenericPassword('session', JSON.stringify(session), { service: NATIVE_SESSION_SERVICE });
        if (!saved) throw new Error('Secure session storage did not accept the session.');
      }
    } catch {
      throw new AuthServiceError(
        'Your account responded, but this device could not save the sign-in securely. Please try signing in again. Your saved chats have not been deleted.',
        'storage',
      );
    }
    inMemorySession = session;
    return session;
  }
}

export const browserAuthService = new BrowserAuthService();
