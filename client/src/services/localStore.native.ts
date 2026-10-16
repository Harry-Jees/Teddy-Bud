import { isSQLCipher, Storage } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import type { LocalStore } from './localStore';

const DATABASE_NAME = 'teddy-bud-local.sqlite';
const DATABASE_KEY_SERVICE = 'com.teddybud.local-data-key';

export async function createLocalStore(): Promise<LocalStore> {
  if (!isSQLCipher()) {
    throw new Error('Encrypted local storage is unavailable in this app build. Please install a supported, up-to-date app build.');
  }

  const storedKey = await Keychain.getGenericPassword({ service: DATABASE_KEY_SERVICE });
  let encryptionKey = storedKey ? storedKey.password : '';
  if (!encryptionKey) {
    const crypto = globalThis.crypto;
    if (!crypto?.getRandomValues) throw new Error('A secure random source is unavailable for local database encryption.');
    encryptionKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    const saved = await Keychain.setGenericPassword('teddy-bud-local-data', encryptionKey, {
      service: DATABASE_KEY_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (!saved) throw new Error('The local database encryption key could not be stored securely.');
  }

  return new Storage({ name: DATABASE_NAME, encryptionKey });
}
