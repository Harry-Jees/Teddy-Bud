import { createEncryptedBackup, MAX_BACKUP_BYTES, mergeLocalAppData, readEncryptedBackup } from '../src/services/backup';
import type { LocalAppData } from '../src/services/localData';

var mockBackupDatabase: Map<string, string>;
var mockBackupEncryptionPassword: string | null;

jest.mock('@op-engineering/op-sqlite', () => ({
  Storage: class {
    async getItem(key: string) { return mockBackupDatabase.get(key); }
    async setItem(key: string, value: string) { mockBackupDatabase.set(key, value); }
    async removeItem(key: string) { mockBackupDatabase.delete(key); }
  },
  isSQLCipher: () => true,
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  getGenericPassword: jest.fn(async () => mockBackupEncryptionPassword ? { password: mockBackupEncryptionPassword } : false),
  setGenericPassword: jest.fn(async (_username: string, password: string) => {
    mockBackupEncryptionPassword = password;
    return { service: 'test' };
  }),
}));

const sampleData: LocalAppData = {
  conversations: [{
    id: 'chat-1',
    title: 'A private chat',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: '2026-01-01T09:00:00.000Z',
    messages: [{ id: 1, text: 'Private message text', author: 'you', time: '9:00 AM' }],
    pinned: true,
  }],
  activeConversationId: 'chat-1',
  memories: [{ id: 2, text: 'A private memory', date: 'Today' }],
  emotionCheckIns: [],
  journalEntries: [],
  rememberInSession: true,
  shareMemories: false,
  shareChatHistory: false,
  shareAboutMe: true,
  aboutMe: 'Likes short answers',
  assistantName: 'Buddy',
  assistantCharacterId: 'teddy-bud',
  assistantCharacterNames: { 'teddy-bud': 'Buddy', doodle: 'Doodle', sunny: 'Sunny', mellow: 'Mellow', sage: 'Sage', ember: 'Ember', orbit: 'Orbit', muse: 'Muse', harbor: 'Harbor', nova: 'Nova' },
};

describe('encrypted Teddy Bud backups', () => {
  beforeEach(() => {
    mockBackupDatabase = new Map();
    mockBackupEncryptionPassword = null;
  });
  test('round-trips chats, memories, profile, and preferences without exposing plaintext', async () => {
    const backup = await createEncryptedBackup(sampleData, 'account-a', 'a long private passphrase');
    expect(backup).not.toContain('Private message text');
    expect(backup).not.toContain('Likes short answers');
    await expect(readEncryptedBackup(backup, 'account-a', 'a long private passphrase')).resolves.toEqual(sampleData);
  });

  test('rejects a wrong passphrase and a backup owned by another account', async () => {
    const backup = await createEncryptedBackup(sampleData, 'account-a', 'a long private passphrase');
    await expect(readEncryptedBackup(backup, 'account-a', 'a different passphrase')).rejects.toThrow('could not be unlocked');
    await expect(readEncryptedBackup(backup, 'account-b', 'a long private passphrase')).rejects.toThrow('different account');
  });

  test('rejects unsupported backup parameters and files over the size limit', async () => {
    const backup = await createEncryptedBackup(sampleData, 'account-a', 'a long private passphrase');
    const unsupported = JSON.parse(backup) as { iterations: number };
    unsupported.iterations += 1;
    await expect(readEncryptedBackup(JSON.stringify(unsupported), 'account-a', 'a long private passphrase'))
      .rejects.toThrow('not a supported Teddy Bud backup');
    await expect(readEncryptedBackup('x'.repeat(MAX_BACKUP_BYTES + 1), 'account-a', 'a long private passphrase'))
      .rejects.toThrow('larger than the supported 25 MB limit');
  });
});


describe('backup merge behavior', () => {
  test('preserves local preferences and records while adding imported records without duplicate IDs', () => {
    const current: LocalAppData = {
      ...sampleData,
      conversations: [{ ...sampleData.conversations[0], id: 'local-chat', title: 'Local chat', updatedAt: '2026-02-01T09:00:00.000Z' }],
      activeConversationId: 'local-chat',
      memories: [{ id: 2, text: 'Local memory', date: 'Today' }],
      emotionCheckIns: [{ id: 'check-local', createdAt: '2026-02-01T09:00:00.000Z', emotions: { calm: 3 }, energy: 3, support: 'listen' }],
      journalEntries: [{ id: 'journal-local', createdAt: '2026-02-01T09:00:00.000Z', title: 'Local', body: 'Keep this', prompt: '' }],
      assistantName: 'My Buddy',
      assistantCharacterNames: { ...sampleData.assistantCharacterNames, 'teddy-bud': 'My Buddy' },
      shareMemories: false,
    };
    const imported: LocalAppData = {
      ...sampleData,
      conversations: [
        { ...sampleData.conversations[0], id: 'import-chat', title: 'Imported chat' },
        { ...sampleData.conversations[0], id: 'local-chat', title: 'Newer imported snapshot', updatedAt: '2026-03-01T09:00:00.000Z' },
      ],
      activeConversationId: 'import-chat',
      memories: [
        { id: 2, text: 'Imported memory', date: 'Yesterday' },
        { id: 3, text: 'Local memory', date: 'Today' },
      ],
      emotionCheckIns: [{ id: 'check-import', createdAt: '2026-03-01T09:00:00.000Z', emotions: { happy: 4 }, energy: 4, support: 'encouragement' }],
      journalEntries: [{ id: 'journal-import', createdAt: '2026-03-01T09:00:00.000Z', title: 'Imported', body: 'Add this', prompt: '' }],
      assistantName: 'Imported Buddy',
      shareMemories: true,
    };

    const merged = mergeLocalAppData(current, imported);
    expect(merged.conversations.map(item => item.id)).toEqual(['local-chat', 'import-chat']);
    expect(merged.conversations.find(item => item.id === 'local-chat')?.title).toBe('Newer imported snapshot');
    expect(merged.activeConversationId).toBe('local-chat');
    expect(merged.memories).toHaveLength(2);
    expect(new Set(merged.memories.map(item => item.id)).size).toBe(2);
    expect(merged.memories.some(item => item.text === 'Imported memory')).toBe(true);
    expect(merged.emotionCheckIns?.map(item => item.id)).toEqual(['check-local', 'check-import']);
    expect(merged.journalEntries?.map(item => item.id)).toEqual(['journal-local', 'journal-import']);
    expect(merged.assistantName).toBe('My Buddy');
    expect(merged.shareMemories).toBe(false);
  });

  test('deduplicates repeated imported IDs and repeated memory content', () => {
    const imported = {
      ...sampleData,
      memories: [
        { id: 4, text: 'A memory', date: 'Today' },
        { id: 5, text: ' A MEMORY ', date: 'Today' },
      ],
      emotionCheckIns: [
        { id: 'same-check', createdAt: '2026-01-01T09:00:00.000Z', emotions: { calm: 2 }, energy: 2, support: 'listen' as const },
        { id: 'same-check', createdAt: '2026-01-02T09:00:00.000Z', emotions: { calm: 3 }, energy: 3, support: 'listen' as const },
      ],
    };
    const merged = mergeLocalAppData({ ...sampleData, memories: [], emotionCheckIns: [] }, imported);
    expect(merged.memories).toHaveLength(1);
    expect(merged.emotionCheckIns).toHaveLength(1);
  });
});
