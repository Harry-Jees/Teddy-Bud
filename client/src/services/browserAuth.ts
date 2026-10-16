import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { StoredSession } from './deviceAuth';
import { GATEWAY_BASE_URL } from '../config/gateway';

type LoginResponse = { accessToken: string; expiresIn?: number; userId?: string };

const SESSION_KEY = 'teddy-bud:browser-session';
const NATIVE_SESSION_SERVICE = 'com.teddybud.account-auth';
let inMemorySession: StoredSession | null = null;
const REMEMBERED_EMAIL_KEY = 'teddy-bud:remembered-email';

function sessionStore(): Storage | null {
  return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
}

function persistentStore(): Storage | null {
  return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
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
  getRememberedEmail(): string {
    try {
      return persistentStore()?.getItem(REMEMBERED_EMAIL_KEY)?.trim() ?? '';
    } catch {
      return '';
    }
  }

  rememberEmail(email: string): void {
    persistentStore()?.setItem(REMEMBERED_EMAIL_KEY, email.trim());
  }

  private async readStoredSession(): Promise<StoredSession | null> {
    const saved = Platform.OS === 'web'
      ? sessionStore()?.getItem(SESSION_KEY) ?? null
      : (await Keychain.getGenericPassword({ service: NATIVE_SESSION_SERVICE }))?.password ?? null;
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

  async restore(): Promise<StoredSession | null> {
    const current = inMemorySession ?? await this.readStoredSession();
    if (!current) return null;
    inMemorySession = current;
    if (current.expiresAt <= Date.now() + 30_000) {
      try {
        return await this.refresh();
      } catch (error) {
        if ((error as { status?: number }).status === 401) return null;
        throw error;
      }
    }
    return current;
  }

  async beginSignup(email: string, password: string): Promise<void> {
    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}/auth/callback`
      : 'teddybud://auth/callback';
    await request<{ verificationRequired: boolean }>('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, redirectTo }),
    });
    this.rememberEmail(email);
  }

  async consumeCallback(callbackUrl: string): Promise<StoredSession | null> {
    const callback = new URL(callbackUrl);
    const fragment = new URLSearchParams(callback.hash.slice(1));
    const accessToken = fragment.get('access_token') ?? callback.searchParams.get('access_token');
    const callbackError = fragment.get('error_description') ?? callback.searchParams.get('error_description');
    if (callbackError) throw new Error(callbackError);
    if (!accessToken) return null;
    const result = await request<LoginResponse>('/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${window.location.origin}/`);
    }
    return this.save(result);
  }

  async login(email: string, password: string): Promise<StoredSession> {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    this.rememberEmail(email);
    return this.save(result);
  }

  async refresh(): Promise<StoredSession> {
    const current = inMemorySession ?? await this.readStoredSession();
    if (!current) throw new Error('Your session has ended. Please log in again.');
    try {
      const response = await request<LoginResponse>('/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${current.accessToken}` } });
      return await this.save(response);
    } catch (error) {
      if ((error as { status?: number }).status === 401) await this.clear();
      throw error;
    }
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
      sessionStore()?.removeItem(SESSION_KEY);
    } else {
      await Keychain.resetGenericPassword({ service: NATIVE_SESSION_SERVICE });
    }
  }

  private async save(response: LoginResponse): Promise<StoredSession> {
    if (!response.accessToken) throw new Error('The gateway did not return an access token.');
    const session = { accessToken: response.accessToken, expiresAt: expiresAt(response.accessToken, response.expiresIn ?? 3600) };
    if (Platform.OS === 'web') {
      sessionStore()?.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      const saved = await Keychain.setGenericPassword('session', JSON.stringify(session), { service: NATIVE_SESSION_SERVICE });
      if (!saved) throw new Error('Could not save your secure sign-in session.');
    }
    inMemorySession = session;
    return session;
  }
}

export const browserAuthService = new BrowserAuthService();