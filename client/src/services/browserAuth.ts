import { Linking, Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import type { StoredSession } from './session';
import { GATEWAY_BASE_URL } from '../config/gateway';

type LoginResponse = { accessToken: string; expiresIn?: number; userId?: string; profilePictureUrl?: string };

const SESSION_KEY = 'teddy-bud:browser-session';
const NATIVE_SESSION_SERVICE = 'com.teddybud.account-auth';
const currentPath = typeof window !== 'undefined' ? window.location?.pathname ?? '/' : '/';
const WEB_BASE_PATH = currentPath === '/Teddy-Bud' || currentPath.startsWith('/Teddy-Bud/') ? '/Teddy-Bud' : '';
let inMemorySession: StoredSession | null = null;

function sessionStore(): Storage | null {
  return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
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
  private callbackInFlight = new Map<string, Promise<StoredSession | null>>();

  private async readStoredSession(): Promise<StoredSession | null> {
    let saved: string | null;
    if (Platform.OS === 'web') {
      saved = sessionStore()?.getItem(SESSION_KEY) ?? null;
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

  async signInWithGoogle(): Promise<void> {
    const callback = Platform.OS === 'web'
      ? `${window.location.origin}${WEB_BASE_PATH}/auth/callback`
      : 'teddybud://auth/callback';
    const startUrl = new URL(`${GATEWAY_BASE_URL}/auth/google/start`);
    startUrl.searchParams.set('redirect_uri', callback);
    if (Platform.OS === 'web') {
      window.location.assign(startUrl.toString());
      return;
    }
    await Linking.openURL(startUrl.toString());
  }

  async consumeCallback(callbackUrl: string): Promise<StoredSession | null> {
    const inFlight = this.callbackInFlight.get(callbackUrl);
    if (inFlight) return inFlight;
    const attempt = this.consumeCallbackOnce(callbackUrl);
    this.callbackInFlight.set(callbackUrl, attempt);
    try {
      return await attempt;
    } finally {
      if (this.callbackInFlight.get(callbackUrl) === attempt) this.callbackInFlight.delete(callbackUrl);
    }
  }

  private async consumeCallbackOnce(callbackUrl: string): Promise<StoredSession | null> {
    const callback = new URL(callbackUrl);
    const callbackError = callback.searchParams.get('error_description');
    if (callbackError) throw new Error(callbackError);
    const code = callback.searchParams.get('code');
    const oauthState = callback.searchParams.get('oauth_state');
    if (!code && !oauthState) return null;
    if (!code || !oauthState) throw new Error('The Google sign-in response is incomplete. Please try again.');
    const result = await request<LoginResponse>('/auth/google/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state: oauthState }),
    });
    const session = await this.save(result);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${callback.origin}${WEB_BASE_PATH || '/'}`);
    }
    return session;
  }

  async refresh(): Promise<StoredSession> {
    const current = inMemorySession ?? await this.readStoredSession();
    if (!current) throw Object.assign(new Error('Your session has ended. Please log in again.'), { status: 401 });
    try {
      const response = await request<LoginResponse>('/auth/refresh', { method: 'POST', headers: { Authorization: `Bearer ${current.accessToken}` } });
      response.profilePictureUrl ??= current.profilePictureUrl;
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
    const session = { accessToken: response.accessToken, expiresAt: expiresAt(response.accessToken, response.expiresIn ?? 3600), ...(response.profilePictureUrl ? { profilePictureUrl: response.profilePictureUrl } : {}) };
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
