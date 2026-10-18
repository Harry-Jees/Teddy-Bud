import { createLocalStore } from './localStore';
import type { LocalStore } from './localStore';

export type LocalMessage = {
  id: number;
  text: string;
  author: 'you' | 'teddy';
  time: string;
};

export type LocalConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: LocalMessage[];
};

export type LocalMemory = {
  id: number;
  text: string;
  date: string;
};

export type LocalAppData = {
  conversations: LocalConversation[];
  activeConversationId: string | null;
  memories: LocalMemory[];
  rememberInSession: boolean;
  shareMemories: boolean;
};

const DATA_KEY_PREFIX = 'teddy-bud:local-data:';
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
  const legacyMessages = Array.isArray((value as { messages?: unknown }).messages)
    ? (value as { messages: unknown[] }).messages.filter(isLocalMessage)
    : [];
  const conversations = Array.isArray(data.conversations)
    ? data.conversations.flatMap(conversation => {
      if (
        !conversation
        || typeof conversation.id !== 'string'
        || typeof conversation.title !== 'string'
        || typeof conversation.createdAt !== 'string'
        || typeof conversation.updatedAt !== 'string'
        || !Array.isArray(conversation.messages)
      ) return [];
      return [{
        ...conversation,
        messages: conversation.messages.filter(isLocalMessage),
      }];
    })
    : legacyMessages.length
      ? [{
        id: 'legacy-conversation',
        title: legacyMessages.find(message => message.author === 'you')?.text.trim().slice(0, 48) || 'Previous conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: legacyMessages,
      }]
      : [];
  const activeConversationId = typeof data.activeConversationId === 'string'
    && conversations.some(conversation => conversation.id === data.activeConversationId)
    ? data.activeConversationId
    : conversations[0]?.id ?? null;
  return {
    conversations,
    activeConversationId,
    memories: rememberInSession && Array.isArray(data.memories)
      ? data.memories.filter(memory => memory && typeof memory.id === 'number' && typeof memory.text === 'string' && typeof memory.date === 'string').map(memory => ({ ...memory, text: memory.text.slice(0, MAX_MEMORY_LENGTH) }))
      : [],
    rememberInSession,
    shareMemories: rememberInSession && data.shareMemories === true,
  };
}

function isLocalMessage(message: unknown): message is LocalMessage {
  return Boolean(message)
    && typeof message === 'object'
    && typeof (message as LocalMessage).id === 'number'
    && typeof (message as LocalMessage).text === 'string'
    && ((message as LocalMessage).author === 'you' || (message as LocalMessage).author === 'teddy')
    && typeof (message as LocalMessage).time === 'string';
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
    if (!saved) return { conversations: [], activeConversationId: null, memories: [], rememberInSession: true, shareMemories: false };
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
