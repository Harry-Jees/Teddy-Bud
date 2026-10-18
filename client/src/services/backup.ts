import { normalizeLocalAppData } from './localData';
import type { LocalAppData } from './localData';

const BACKUP_FORMAT = 'teddybud-backup';
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

type BackupEnvelope = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  encryption: 'PBKDF2-SHA-256/AES-256-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('Secure backup encryption is unavailable in this browser.');
  }
  return globalThis.crypto;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const crypto = cryptoApi();
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const saltBuffer = Uint8Array.from(salt).buffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createEncryptedBackup(data: LocalAppData, owner: string, passphrase: string): Promise<string> {
  if (!owner) throw new Error('A signed-in account is required to create a backup.');
  if (passphrase.trim().length < 12) throw new Error('Choose a backup passphrase with at least 12 characters.');
  const crypto = cryptoApi();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const payload = JSON.stringify({ owner, data: normalizeLocalAppData(data) });
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(payload));
  const envelope: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    encryption: 'PBKDF2-SHA-256/AES-256-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

export async function readEncryptedBackup(text: string, owner: string, passphrase: string): Promise<LocalAppData> {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('This backup is larger than the supported 25 MB limit.');
  if (passphrase.trim().length < 12) throw new Error('Enter the 12-character-or-longer passphrase used for this backup.');
  let envelope: BackupEnvelope;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') throw new Error();
    envelope = parsed as BackupEnvelope;
    if (
      envelope.format !== BACKUP_FORMAT
      || envelope.version !== BACKUP_VERSION
      || envelope.encryption !== 'PBKDF2-SHA-256/AES-256-GCM'
      || !Number.isInteger(envelope.iterations)
      || envelope.iterations < 100_000
      || envelope.iterations > 1_000_000
      || typeof envelope.salt !== 'string'
      || typeof envelope.iv !== 'string'
      || typeof envelope.ciphertext !== 'string'
    ) throw new Error();
  } catch {
    throw new Error('That file is not a supported Teddy Bud backup.');
  }

  try {
    const key = await deriveKey(passphrase, decodeBase64(envelope.salt), envelope.iterations);
    const iv = Uint8Array.from(decodeBase64(envelope.iv)).buffer;
    const ciphertext = Uint8Array.from(decodeBase64(envelope.ciphertext)).buffer;
    const plaintext = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const payload: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!payload || typeof payload !== 'object' || !('owner' in payload) || payload.owner !== owner || !('data' in payload)) {
      throw new Error('This backup belongs to a different account. Sign in with the Google account that created it.');
    }
    return normalizeLocalAppData(payload.data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This backup belongs')) throw error;
    throw new Error('The backup could not be unlocked. Check your passphrase and try again.');
  }
}
