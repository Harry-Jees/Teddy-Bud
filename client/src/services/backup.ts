import { normalizeLocalAppData } from './localData';
import type { LocalAppData } from './localData';

const BACKUP_FORMAT = 'teddybud-backup';
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

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
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Backup encoding is invalid.');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function validateBackupData(value: unknown): LocalAppData {
  if (!value || typeof value !== 'object') throw new Error('Backup data is incomplete.');
  const data = value as Partial<LocalAppData>;
  if (!Array.isArray(data.conversations) || !Array.isArray(data.memories)) throw new Error('Backup data is incomplete.');
  if (data.activeConversationId !== null && typeof data.activeConversationId !== 'string') throw new Error('Backup chat selection is invalid.');
  for (const conversation of data.conversations) {
    if (!conversation || typeof conversation !== 'object'
      || typeof conversation.id !== 'string' || !conversation.id
      || typeof conversation.title !== 'string' || !conversation.title.trim()
      || typeof conversation.createdAt !== 'string' || typeof conversation.updatedAt !== 'string'
      || !Array.isArray(conversation.messages)
      || !conversation.messages.every(message => message && typeof message === 'object'
        && Number.isFinite(message.id) && typeof message.text === 'string'
        && (message.author === 'you' || message.author === 'teddy') && typeof message.time === 'string')) {
      throw new Error('A saved chat in this backup is invalid.');
    }
  }
  for (const memory of data.memories) {
    if (!memory || typeof memory !== 'object' || !Number.isFinite(memory.id)
      || typeof memory.text !== 'string' || !memory.text.trim() || memory.text.length > 500
      || typeof memory.date !== 'string') throw new Error('A saved memory in this backup is invalid.');
  }
  if (typeof data.rememberInSession !== 'boolean' || typeof data.shareMemories !== 'boolean'
    || typeof data.shareChatHistory !== 'boolean' || typeof data.shareAboutMe !== 'boolean'
    || typeof data.aboutMe !== 'string' || data.aboutMe.length > 2_000
    || typeof data.assistantName !== 'string' || !data.assistantName.trim() || data.assistantName.length > 32) {
    throw new Error('Backup settings are invalid.');
  }
  if (data.activeConversationId && !data.conversations.some(conversation => conversation.id === data.activeConversationId)) {
    throw new Error('The selected chat in this backup is missing.');
  }
  return normalizeLocalAppData(data);
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
  const payload = JSON.stringify({ owner, data: normalizeLocalAppData(data) });
  if (new TextEncoder().encode(payload).byteLength > 18 * 1024 * 1024) {
    throw new Error('This device data is too large to export as one backup. Remove older chats and try again.');
  }
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
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
  const result = JSON.stringify(envelope);
  if (result.length > MAX_BACKUP_BYTES) throw new Error('This backup is larger than the supported 25 MB limit.');
  return result;
}

export async function readEncryptedBackup(text: string, owner: string, passphrase: string): Promise<LocalAppData> {
  if (!owner) throw new Error('Sign in to the account that owns this backup before importing it.');
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
      || envelope.iterations !== PBKDF2_ITERATIONS
      || typeof envelope.salt !== 'string'
      || typeof envelope.iv !== 'string'
      || typeof envelope.ciphertext !== 'string'
      || envelope.ciphertext.length > MAX_BACKUP_BYTES * 2
    ) throw new Error();
  } catch {
    throw new Error('That file is not a supported Teddy Bud backup.');
  }

  try {
    const salt = decodeBase64(envelope.salt);
    const decodedIv = decodeBase64(envelope.iv);
    const decodedCiphertext = decodeBase64(envelope.ciphertext);
    if (salt.byteLength !== 16 || decodedIv.byteLength !== 12 || decodedCiphertext.byteLength < 16) {
      throw new Error('The backup cryptographic fields have invalid lengths.');
    }
    const key = await deriveKey(passphrase, salt, envelope.iterations);
    const iv = Uint8Array.from(decodedIv).buffer;
    const ciphertext = Uint8Array.from(decodedCiphertext).buffer;
    const plaintext = await cryptoApi().subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const payload: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!payload || typeof payload !== 'object' || !('owner' in payload) || payload.owner !== owner || !('data' in payload)) {
      throw new Error('This backup belongs to a different account. Sign in with the Google account that created it.');
    }
    return validateBackupData(payload.data);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This backup belongs')) throw error;
    if (error instanceof Error && /^(Backup data|A saved chat|A saved memory|Backup settings|The selected chat)/.test(error.message)) throw error;
    throw new Error('The backup could not be unlocked. Check your passphrase and try again.');
  }
}
