import { LocalAppData, LocalDataService } from '../src/services/localData';

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
  return { conversations: [], activeConversationId: null, memories: [], rememberInSession: true, shareMemories: false };
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
    });
    const saved = await service.load('account-a');

    expect(saved.conversations).toHaveLength(3);
    expect(saved.conversations.find(conversation => conversation.id === 'chat-0')?.messages).toHaveLength(205);
    expect(saved.memories).toHaveLength(52);
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
    }));

    const migrated = await service.load('account-a');

    expect(migrated.conversations).toHaveLength(1);
    expect(migrated.conversations[0].title).toBe('First message');
    expect(migrated.conversations[0].messages).toHaveLength(2);
    expect(migrated.activeConversationId).toBe(migrated.conversations[0].id);
  });

  test('does not keep or share memories when memory storage is disabled', async () => {
    await service.save('account-a', {
      ...emptyData(),
      memories: [{ id: 1, text: 'Private note', date: 'Today' }],
      rememberInSession: false,
      shareMemories: true,
    });

    expect(await service.load('account-a')).toEqual({
      ...emptyData(),
      rememberInSession: false,
    });
  });
});
