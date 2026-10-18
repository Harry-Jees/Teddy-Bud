import { createEncryptedBackup, MAX_BACKUP_BYTES, readEncryptedBackup } from '../src/services/backup';
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
  rememberInSession: true,
  shareMemories: false,
  shareChatHistory: false,
  shareAboutMe: true,
  aboutMe: 'Likes short answers',
  assistantName: 'Buddy',
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
