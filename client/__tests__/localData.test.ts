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
  return { messages: [], memories: [], rememberInSession: true, shareMemories: false };
}

describe('LocalDataService', () => {
  const service = new LocalDataService();

  beforeEach(() => {
    mockDatabase = new Map();
    mockEncryptionPassword = null;
  });

  test('persists data per account and clears only the selected account', async () => {
    const accountData: LocalAppData = {
      messages: [{ id: 1, text: 'Hello', author: 'you', time: '9:00 AM' }],
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

  test('bounds persisted chat and memory data', async () => {
    const messages = Array.from({ length: 205 }, (_, id) => ({
      id,
      text: `Message ${id}`,
      author: 'you' as const,
      time: '9:00 AM',
    }));
    const memories = Array.from({ length: 52 }, (_, id) => ({
      id,
      text: 'x'.repeat(520),
      date: 'Today',
    }));

    await service.save('account-a', {
      messages,
      memories,
      rememberInSession: true,
      shareMemories: true,
    });
    const saved = await service.load('account-a');

    expect(saved.messages).toHaveLength(200);
    expect(saved.messages[0].id).toBe(5);
    expect(saved.memories).toHaveLength(50);
    expect(saved.memories[0].text).toHaveLength(500);
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
