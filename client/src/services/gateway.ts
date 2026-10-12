export type GatewayMessageRole = 'user' | 'assistant' | 'system';

export interface GatewayMessage {
  role: GatewayMessageRole;
  content: string;
}

interface GatewaySession {
  accessToken: string;
  expiresAt: number;
}

const STORAGE_PREFIX = 'teddy-bud';
const DEFAULT_MODEL_ID = 'meta/llama-3.1-8b-instruct';

function readStorage(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return globalThis[`${STORAGE_PREFIX}.__memory__` as keyof typeof globalThis] as string | null;
}

function writeStorage(key: string, value: string | null) {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value ?? '');
    return;
  }
  const store = globalThis as typeof globalThis & {
    [key: string]: unknown;
  };
  if (value == null) {
    delete store[key];
    return;
  }
  store[key] = value;
}

function getStorageKey(name: string) {
  return `${STORAGE_PREFIX}:${name}`;
}

function makeUuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

async function createPublicKeyPem(): Promise<string> {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto is not available in this runtime.');
  }

  const keyPair = await globalThis.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );

  const spki = await globalThis.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const base64 = arrayBufferToBase64(spki);
  const wrapped = base64.match(/.{1,64}/g)?.join('\n') ?? base64;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const errorMessage = payload?.error?.message ?? payload?.message ?? 'Request failed.';
    throw new Error(errorMessage);
  }

  return payload as T;
}

export class GatewayService {
  constructor(private readonly baseUrl: string) {}

  private async getStoredSession(): Promise<GatewaySession | null> {
    const saved = readStorage(getStorageKey('gateway-session'));
    if (!saved) {
      return null;
    }

    try {
      const parsed = JSON.parse(saved) as GatewaySession;
      if (!parsed.accessToken || !parsed.expiresAt) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async storeSession(session: GatewaySession | null) {
    if (!session) {
      writeStorage(getStorageKey('gateway-session'), null);
      return;
    }

    writeStorage(getStorageKey('gateway-session'), JSON.stringify(session));
  }

  async ensureReady(): Promise<GatewaySession> {
    const existing = await this.getStoredSession();
    if (existing && existing.expiresAt > Date.now() + 60_000) {
      return existing;
    }

    const deviceId = readStorage(getStorageKey('device-id')) ?? makeUuid();
    writeStorage(getStorageKey('device-id'), deviceId);

    const publicKey = await createPublicKeyPem();
    const payload = { deviceId, publicKey };

    const response = await fetchJson<{ accessToken: string; expiresIn?: number }>(
      `${this.baseUrl}/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    const nextSession: GatewaySession = {
      accessToken: response.accessToken,
      expiresAt: Date.now() + (response.expiresIn ?? 3600) * 1000,
    };

    await this.storeSession(nextSession);
    return nextSession;
  }

  async getModels(accessToken: string): Promise<string[]> {
    const body = await fetchJson<{ data?: Array<{ id?: string }> }>(
      `${this.baseUrl}/v1/models`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return (body.data ?? []).map((item) => item.id).filter((model): model is string => Boolean(model));
  }

  async sendChatMessage(message: string, history: GatewayMessage[], sessionToken?: string): Promise<string> {
    const session = await this.ensureReady();
    const accessToken = sessionToken || session.accessToken;
    const modelOptions = await this.getModels(accessToken);
    const modelId = modelOptions[0] ?? DEFAULT_MODEL_ID;

    const messages: GatewayMessage[] = [
      ...history.map((entry): GatewayMessage => ({ role: entry.role, content: entry.content.trim() })).filter((entry) => entry.content),
      { role: 'user' as const, content: message.trim() },
    ].slice(-12);

    const response = await fetchJson<{
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    }>(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: false,
        max_tokens: 300,
      }),
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(response.error?.message ?? 'No reply was returned by the conversation service.');
    }

    return content.trim();
  }
}
