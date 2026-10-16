import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { GATEWAY_BASE_URL } from '../config/gateway';

export type StoredSession = { accessToken: string; expiresAt: number };

type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
  session?: StoredSession;
};

const SERVICE = 'com.teddybud.device-auth';

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function randomUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('A cryptographically secure random source is not available.');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function tokenExpiry(token: string, fallback: number) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return fallback;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const parsed = JSON.parse(decodeURIComponent(atob(normalized).split('').map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join('')));
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : fallback;
  } catch { return fallback; }
}

function ensureNativeSecureStorage() {
  if (Platform.OS === 'web') throw new Error('Device authentication requires native secure storage. Web preview is not supported for secure gateway sign-in.');
}

async function readIdentity(): Promise<DeviceIdentity | null> {
  ensureNativeSecureStorage();
  const stored = await Keychain.getGenericPassword({ service: SERVICE });
  if (!stored) return null;
  try { return JSON.parse(stored.password) as DeviceIdentity; } catch { return null; }
}

async function writeIdentity(identity: DeviceIdentity | null) {
  ensureNativeSecureStorage();
  if (!identity) { await Keychain.resetGenericPassword({ service: SERVICE }); return; }
  await Keychain.setGenericPassword(identity.deviceId, JSON.stringify(identity), { service: SERVICE });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_BASE_URL}${path}`, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? payload?.message ?? `Gateway request failed (${response.status}).`);
  return payload as T;
}

async function generateIdentity(): Promise<DeviceIdentity> {
  ensureNativeSecureStorage();
  const subtle = globalThis.crypto?.subtle as SubtleCrypto & { generateKey: (algorithm: unknown, extractable: boolean, usages: KeyUsage[]) => Promise<CryptoKeyPair> } | undefined;
  if (!subtle) throw new Error('WebCrypto is not available for device registration.');
  const keyPair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const publicKey = await subtle.exportKey('raw', keyPair.publicKey);
  const privateKey = await subtle.exportKey('pkcs8', keyPair.privateKey);
  return { deviceId: randomUuid(), publicKey: toBase64(publicKey), privateKey: toBase64(privateKey) };
}

export class DeviceAuthService {
  async restore(): Promise<StoredSession | null> {
    const identity = await readIdentity();
    if (!identity?.session || identity.session.expiresAt <= Date.now() + 30_000) return null;
    return identity.session;
  }

  async register(): Promise<StoredSession> {
    let identity = await readIdentity();
    if (!identity) identity = await generateIdentity();
    const response = await requestJson<{ accessToken: string; expiresIn?: number }>('/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: identity.deviceId, publicKey: identity.publicKey }),
    });
    const expiresAt = tokenExpiry(response.accessToken, Date.now() + (response.expiresIn ?? 3600) * 1000);
    const session = { accessToken: response.accessToken, expiresAt };
    await writeIdentity({ ...identity, session });
    return session;
  }

  async refresh(): Promise<StoredSession> {
    const identity = await readIdentity();
    if (!identity) throw new Error('This device has not been registered.');
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = new TextEncoder().encode(`${identity.deviceId}:${timestamp}`);
    const privateKey = await crypto.subtle.importKey('pkcs8', fromBase64(identity.privateKey), { name: 'Ed25519' }, false, ['sign']);
    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, payload);
    const response = await requestJson<{ accessToken: string; expiresIn?: number }>('/auth/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: identity.deviceId, timestamp, signature: toBase64(signature) }),
    });
    const expiresAt = tokenExpiry(response.accessToken, Date.now() + (response.expiresIn ?? 3600) * 1000);
    const session = { accessToken: response.accessToken, expiresAt };
    await writeIdentity({ ...identity, session });
    return session;
  }

  async clear() { await writeIdentity(null); }
}

export const deviceAuthService = new DeviceAuthService();
