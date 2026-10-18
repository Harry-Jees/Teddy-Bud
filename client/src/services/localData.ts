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
  shareChatHistory: boolean;
};

const DATA_KEY_PREFIX = 'teddy-bud:local-data:';
const MAX_MEMORY_LENGTH = 500;
const MAX_CROSS_CHAT_CONTEXT_CHARS = 1_800;
const MAX_CROSS_CHAT_EXCERPTS = 3;
const MAX_CROSS_CHAT_EXCERPT_LENGTH = 700;
const SEARCH_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'before', 'being',
  'but', 'can', 'could', 'did', 'does', 'doing', 'for', 'from', 'get', 'got', 'had',
  'has', 'have', 'her', 'here', 'him', 'his', 'how', 'into', 'its', 'just', 'like',
  'make', 'maybe', 'more', 'most', 'much', 'myself', 'not', 'now', 'only', 'our',
  'out', 'over', 'really', 'same', 'she', 'should', 'some', 'than', 'that', 'the',
  'their', 'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'very', 'was', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'will',
  'with', 'would', 'you', 'your',
]);

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
    shareChatHistory: data.shareChatHistory === true,
  };
}

function searchTerms(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      .filter(term => !SEARCH_STOPWORDS.has(term)),
  );
}

export function findRelevantChatHistory(
  conversations: LocalConversation[],
  activeConversationId: string | null,
  message: string,
): string[] {
  const queryTerms = searchTerms(message);
  if (!queryTerms.size) return [];

  const candidates = conversations
    .filter(conversation => conversation.id !== activeConversationId)
    .flatMap(conversation => conversation.messages.flatMap((chatMessage, index) => {
      if (chatMessage.author !== 'you' || !chatMessage.text.trim()) return [];
      const reply = conversation.messages[index + 1];
      const exchange = [chatMessage, ...(reply?.author === 'teddy' ? [reply] : [])];
      const exchangeText = exchange.map(item => item.text.trim()).join(' ');
      const terms = searchTerms(exchangeText);
      if (!terms.size) return [];

      // Include the previous turn so short follow-up questions can recover facts
      // introduced just before the matching message (for example, a name).
      const contextStart = index >= 2 && conversation.messages[index - 1]?.author === 'teddy'
        ? index - 2
        : index;
      const contextEnd = reply?.author === 'teddy' ? index + 1 : index;
      const context = conversation.messages.slice(contextStart, contextEnd + 1)
        .map(item => `${item.author === 'you' ? 'You' : 'Teddy'}: ${item.text.trim()}`)
        .join('\n');
      return [{ text: context, terms }];
    }));
  if (!candidates.length) return [];

  const documentFrequency = new Map<string, number>();
  for (const candidate of candidates) {
    for (const term of queryTerms) {
      if (candidate.terms.has(term)) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }

  const termWeights = new Map<string, number>();
  for (const term of queryTerms) {
    termWeights.set(term, Math.log(1 + (candidates.length + 1) / (1 + (documentFrequency.get(term) ?? 0))));
  }
  const totalWeight = [...termWeights.values()].reduce((sum, weight) => sum + weight, 0);
  const relevant = candidates
    .map((candidate, index) => {
      const score = [...queryTerms]
        .filter(term => candidate.terms.has(term))
        .reduce((sum, term) => sum + (termWeights.get(term) ?? 0), 0) / totalWeight;
      return { ...candidate, score, index };
    })
    .filter(candidate => candidate.score >= 0.25)
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const excerpts: string[] = [];
  let used = 0;
  for (const item of relevant) {
    if (excerpts.length >= MAX_CROSS_CHAT_EXCERPTS || used >= MAX_CROSS_CHAT_CONTEXT_CHARS) break;
    const available = Math.min(MAX_CROSS_CHAT_EXCERPT_LENGTH, MAX_CROSS_CHAT_CONTEXT_CHARS - used);
    const excerpt = item.text.length > available
      ? `${item.text.slice(0, available - 1).trimEnd()}…`
      : item.text;
    if (!excerpt) continue;
    excerpts.push(excerpt);
    used += excerpt.length;
  }
  return excerpts;
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
    if (!saved) return { conversations: [], activeConversationId: null, memories: [], rememberInSession: true, shareMemories: false, shareChatHistory: false };
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
