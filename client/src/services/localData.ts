import { createLocalStore } from './localStore';
import type { LocalStore } from './localStore';

export type LocalMessage = {
  id: number;
  text: string;
  author: 'you' | 'teddy';
  time: string;
};

export type LocalMemory = {
  id: number;
  text: string;
  date: string;
};

export type LocalAppData = {
  messages: LocalMessage[];
  memories: LocalMemory[];
  rememberInSession: boolean;
  shareMemories: boolean;
};

const DATA_KEY_PREFIX = 'teddy-bud:local-data:';
const MAX_MESSAGES = 200;
const MAX_MEMORIES = 50;
const MAX_MEMORY_LENGTH = 500;

let storagePromise: Promise<LocalStore> | null = null;

function getStorage(): Promise<LocalStore> {
  if (!storagePromise) {
    const pending = createLocalStore();
    storagePromise = pending;
    pending.catch(() => {
      if (storagePromise === pending) storagePromise = null;
    });
  }
  return storagePromise;
}

export function ownerFromToken(token: string): string {
  try {
    const payload = token.split('.')[1];
    if (!payload) throw new Error('The session token has no owner claim.');
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(decodeURIComponent(atob(normalized).split('').map(char => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`).join('')));
    if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('The session token has no owner claim.');
    return claims.sub;
  } catch {
    throw new Error('Could not identify the signed-in account for local data.');
  }
}

function key(owner: string) {
  return `${DATA_KEY_PREFIX}${encodeURIComponent(owner)}`;
}

function normalize(value: unknown): LocalAppData {
  if (!value || typeof value !== 'object') throw new Error('Saved app data is invalid.');
  const data = value as Partial<LocalAppData>;
  const rememberInSession = data.rememberInSession !== false;
  return {
    messages: Array.isArray(data.messages)
      ? data.messages.filter(message => message && typeof message.id === 'number' && typeof message.text === 'string' && (message.author === 'you' || message.author === 'teddy') && typeof message.time === 'string').slice(-MAX_MESSAGES)
      : [],
    memories: rememberInSession && Array.isArray(data.memories)
      ? data.memories.filter(memory => memory && typeof memory.id === 'number' && typeof memory.text === 'string' && typeof memory.date === 'string').slice(0, MAX_MEMORIES).map(memory => ({ ...memory, text: memory.text.slice(0, MAX_MEMORY_LENGTH) }))
      : [],
    rememberInSession,
    shareMemories: rememberInSession && data.shareMemories === true,
  };
}

export class LocalDataService {
  private writeQueue: Promise<void> = Promise.resolve();

  private enqueue(task: () => Promise<void>): Promise<void> {
    const operation = this.writeQueue.then(task);
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  async load(owner: string): Promise<LocalAppData> {
    if (!owner) throw new Error('A signed-in account is required to load local data.');
    await this.writeQueue;
    const saved = await (await getStorage()).getItem(key(owner));
    if (!saved) return { messages: [], memories: [], rememberInSession: true, shareMemories: false };
    try {
      return normalize(JSON.parse(saved));
    } catch {
      throw new Error('Saved app data could not be read. Clear local data to start a new conversation.');
    }
  }

  async save(owner: string, data: LocalAppData): Promise<void> {
    if (!owner) throw new Error('A signed-in account is required to save local data.');
    const safeData = normalize(data);
    await this.enqueue(async () => (await getStorage()).setItem(key(owner), JSON.stringify(safeData)));
  }

  async clear(owner: string): Promise<void> {
    if (!owner) throw new Error('A signed-in account is required to clear local data.');
    await this.enqueue(async () => (await getStorage()).removeItem(key(owner)));
  }
}

export const localDataService = new LocalDataService();
