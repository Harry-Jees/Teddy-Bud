import { findRelevantChatHistory, LocalAppData, LocalDataService } from '../src/services/localData';

var mockDatabase: Map<string, string>;
var mockEncryptionPassword: string | null;

jest.mock('@op-engineering/op-sqlite', () => ({
  Storage: class {
    async getItem(key: string) {
      return mockDatabase.get(key);
    }

    async setItem(key: string, value: string) {
      mockDatabase.set(key, value);
    }

    async removeItem(key: string) {
      mockDatabase.delete(key);
    }
  },
  isSQLCipher: () => true,
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn(async () => mockEncryptionPassword ? { password: mockEncryptionPassword } : false),
  setGenericPassword: jest.fn(async (_username: string, password: string) => {
    mockEncryptionPassword = password;
    return { service: 'test' };
  }),
}));

function emptyData(): LocalAppData {
  return { conversations: [], activeConversationId: null, memories: [], rememberInSession: true, shareMemories: false, shareChatHistory: false };
}

describe('LocalDataService', () => {
  const service = new LocalDataService();

  beforeEach(() => {
    mockDatabase = new Map();
    mockEncryptionPassword = null;
  });

  test('persists data per account and clears only the selected account', async () => {
    const accountData: LocalAppData = {
      conversations: [{
        id: 'chat-a',
        title: 'Hello',
        createdAt: '2026-01-01T09:00:00.000Z',
        updatedAt: '2026-01-01T09:00:00.000Z',
        messages: [{ id: 1, text: 'Hello', author: 'you', time: '9:00 AM' }],
      }],
      activeConversationId: 'chat-a',
      memories: [{ id: 2, text: 'A saved note', date: 'Today' }],
      rememberInSession: true,
      shareMemories: true,
      shareChatHistory: true,
    };
    await service.save('account-a', accountData);

    expect(await service.load('account-a')).toEqual(accountData);
    expect(await service.load('account-b')).toEqual(emptyData());

    await service.save('account-b', { ...emptyData(), shareMemories: true });
    await service.clear('account-a');

    expect(await service.load('account-a')).toEqual(emptyData());
    expect(await service.load('account-b')).toEqual({ ...emptyData(), shareMemories: true });
  });

  test('persists all chats, messages, and memories without application count limits', async () => {
    const messages = Array.from({ length: 205 }, (_, id) => ({
      id,
      text: `Message ${id}`,
      author: 'you' as const,
      time: '9:00 AM',
    }));
    const memories = Array.from({ length: 52 }, (_, id) => ({
      id,
      text: 'x'.repeat(500),
      date: 'Today',
    }));
    const conversations = Array.from({ length: 3 }, (_, id) => ({
      id: `chat-${id}`,
      title: `Chat ${id}`,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
      messages: id === 0 ? messages : [{ id, text: `Message ${id}`, author: 'you' as const, time: '9:00 AM' }],
    }));

    await service.save('account-a', {
      conversations,
      activeConversationId: 'chat-0',
      memories,
      rememberInSession: true,
      shareMemories: true,
      shareChatHistory: true,
    });
    const saved = await service.load('account-a');

    expect(saved.conversations).toHaveLength(3);
    expect(saved.conversations.find(conversation => conversation.id === 'chat-0')?.messages).toHaveLength(205);
    expect(saved.memories).toHaveLength(52);
    expect(saved.shareChatHistory).toBe(true);
  });

  test('migrates a previous single-chat data record without dropping messages', async () => {
    mockDatabase.set('teddy-bud:local-data:account-a', JSON.stringify({
      messages: [
        { id: 100, text: 'First message', author: 'you', time: '9:00 AM' },
        { id: 101, text: 'Reply', author: 'teddy', time: '9:01 AM' },
      ],
      memories: [],
      rememberInSession: true,
      shareMemories: false,
      shareChatHistory: true,
    }));

    const migrated = await service.load('account-a');

    expect(migrated.conversations).toHaveLength(1);
    expect(migrated.conversations[0].title).toBe('First message');
    expect(migrated.conversations[0].messages).toHaveLength(2);
    expect(migrated.activeConversationId).toBe(migrated.conversations[0].id);
    expect(migrated.shareChatHistory).toBe(true);
  });

  test('does not keep or share memories when memory storage is disabled', async () => {
    await service.save('account-a', {
      ...emptyData(),
      memories: [{ id: 1, text: 'Private note', date: 'Today' }],
      rememberInSession: false,
      shareMemories: true,
      shareChatHistory: true,
    });

    expect(await service.load('account-a')).toEqual({
      ...emptyData(),
      rememberInSession: false,
      shareChatHistory: true,
    });
  });
});

describe('cross-chat history retrieval', () => {
  const conversation = (id: string, messages: LocalAppData['conversations'][number]['messages']) => ({
    id,
    title: id,
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    messages,
  });

  test('selects relevant user excerpts from other chats and excludes the active chat and assistant messages', () => {
    const excerpts = findRelevantChatHistory([
      conversation('old', [
        { id: 1, text: 'I am training for a half marathon and worried about my knee injury.', author: 'you', time: '9:00 AM' },
        { id: 2, text: 'You mentioned a knee injury while training.', author: 'teddy', time: '9:01 AM' },
      ]),
      conversation('active', [
        { id: 3, text: 'My marathon knee injury is improving.', author: 'you', time: '9:02 AM' },
      ]),
      conversation('unrelated', [
        { id: 4, text: 'I am learning to bake sourdough bread.', author: 'you', time: '9:03 AM' },
      ]),
    ], 'active', 'How is my marathon knee injury plan going?');

    expect(excerpts).toEqual(['You: I am training for a half marathon and worried about my knee injury.\nTeddy: You mentioned a knee injury while training.']);
  });

  test('bounds the number and size of selected excerpts', () => {
    const conversations = Array.from({ length: 8 }, (_, index) => conversation(`chat-${index}`, [
      { id: index, text: `My marathon knee plan ${'progress '.repeat(120)}`, author: 'you', time: '9:00 AM' },
    ]));

    const excerpts = findRelevantChatHistory(conversations, null, 'How is my marathon knee plan?');

    expect(excerpts).toHaveLength(3);
    expect(excerpts.every(excerpt => excerpt.length <= 700)).toBe(true);
    expect(excerpts.join('').length).toBeLessThanOrEqual(1_800);
  });
});
