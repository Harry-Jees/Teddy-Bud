import { Linking, Platform } from 'react-native';
import { GATEWAY_BASE_URL } from '../config/gateway';

type StoredSession = { accessToken: string; expiresAt: number };

const SESSION_KEY = 'teddy-bud:access-session';
const STATE_KEY = 'teddy-bud:access-state';
const REDIRECT_URI = 'teddybud://auth/callback';

function storage(): Storage | null {
  return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
}

function read(key: string): string | null {
  return storage()?.getItem(key) ?? null;
}

function write(key: string, value: string | null) {
  const target = storage();
  if (!target) return;
  if (value == null) target.removeItem(key);
  else target.setItem(key, value);
}

function decodePayload(token: string): { exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(decodeURIComponent(atob(normalized).split('').map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join('')));
  } catch {
    return null;
  }
}

function isUsableToken(token: string | undefined, expiresAt?: number) {
  if (!token) return false;
  const tokenExpiry = decodePayload(token)?.exp ? (decodePayload(token)?.exp ?? 0) * 1000 : 0;
  const expiry = expiresAt ?? tokenExpiry;
  return expiry > Date.now() + 30_000;
}

function randomState() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function authLoginUrl() {
  const configured = (globalThis as typeof globalThis & { __TEDDY_ACCESS_LOGIN_URL__?: string }).__TEDDY_ACCESS_LOGIN_URL__;
  return configured || `${GATEWAY_BASE_URL}/auth/login`;
}

export class AccessAuthService {
  async restore(): Promise<StoredSession | null> {
    const saved = read(SESSION_KEY);
    if (!saved) return null;
    try {
      const session = JSON.parse(saved) as StoredSession;
      if (isUsableToken(session.accessToken, session.expiresAt)) return session;
    } catch {
      // Ignore malformed local state and require a fresh login.
    }
    this.clear();
    return null;
  }

  async beginLogin() {
    const state = randomState();
    write(STATE_KEY, state);
    const url = new URL(authLoginUrl());
    url.searchParams.set('redirect_uri', Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : REDIRECT_URI);
    url.searchParams.set('state', state);
    url.searchParams.set('client', 'teddy-bud');

    if (Platform.OS === 'web') {
      window.location.assign(url.toString());
      return;
    }
    await Linking.openURL(url.toString());
  }

  async consumeCallback(url: string): Promise<StoredSession | null> {
    const parsed = new URL(url);
    const expectedState = read(STATE_KEY);
    const state = parsed.searchParams.get('state');
    if (expectedState && state && expectedState !== state) throw new Error('The sign-in response could not be verified. Please try again.');

    const token = parsed.searchParams.get('access_token') || parsed.searchParams.get('token') || parsed.searchParams.get('jwt');
    const expiresIn = Number(parsed.searchParams.get('expires_in') || 3600);
    if (token) return this.save(token, Date.now() + expiresIn * 1000);

    const code = parsed.searchParams.get('code');
    if (!code) {
      const error = parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
      if (error) throw new Error(error);
      return null;
    }

    const response = await fetch(`${GATEWAY_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri: Platform.OS === 'web' ? `${window.location.origin}/auth/callback` : REDIRECT_URI, state }),
    });
    if (!response.ok) throw new Error('Teddy could not complete sign-in. Please try again.');
    const payload = await response.json() as { accessToken?: string; token?: string; expiresIn?: number };
    const accessToken = payload.accessToken || payload.token;
    if (!accessToken) throw new Error('Sign-in completed without a session token.');
    return this.save(accessToken, Date.now() + (payload.expiresIn ?? 3600) * 1000);
  }

  clear() {
    write(SESSION_KEY, null);
    write(STATE_KEY, null);
  }

  private save(accessToken: string, expiresAt: number) {
    const tokenExpiry = decodePayload(accessToken)?.exp ? (decodePayload(accessToken)?.exp ?? 0) * 1000 : expiresAt;
    const effectiveExpiry = Math.min(expiresAt, tokenExpiry);
    if (!isUsableToken(accessToken, effectiveExpiry)) throw new Error('The sign-in session has expired. Please try again.');
    const session = { accessToken, expiresAt: effectiveExpiry };
    write(SESSION_KEY, JSON.stringify(session));
    write(STATE_KEY, null);
    return session;
  }
}

export type { StoredSession };
