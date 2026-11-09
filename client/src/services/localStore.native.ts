import { isSQLCipher, Storage } from '@op-engineering/op-sqlite';
import * as Keychain from 'react-native-keychain';
import type { LocalStore } from './localStore';

const DATABASE_NAME = 'teddy-bud-local';
const DATABASE_KEY_SERVICE = 'com.teddybud.local-data-key';
const LEGACY_DATABASE_NAME = 'teddy-bud-local.sqlite';
const LEGACY_KEY_SERVICE = DATABASE_KEY_SERVICE;
const DATA_KEY_PREFIX = 'teddy-bud:local-data:';

function accountScope(recordKey: string): string {
  return recordKey.startsWith(DATA_KEY_PREFIX)
    ? recordKey.slice(DATA_KEY_PREFIX.length)
    : encodeURIComponent(recordKey);
}

async function storedDatabaseKey(service: string): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service });
  if (existing && typeof existing !== 'boolean') return existing.password;

  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) throw new Error('A secure random source is unavailable for local database encryption.');
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const saved = await Keychain.setGenericPassword('teddy-bud-local-data', key, {
    service,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error('The local database encryption key could not be stored securely.');
  return key;
}

class AccountScopedNativeStore implements LocalStore {
  private readonly stores = new Map<string, Promise<Storage>>();
  private legacyStorePromise: Promise<Storage | null> | null = null;
  private migrationQueue: Promise<void> = Promise.resolve();

  private storeFor(scope: string): Promise<Storage> {
    let store = this.stores.get(scope);
    if (!store) {
      const pending = (async () => {
        const suffix = encodeURIComponent(scope);
        const encryptionKey = await storedDatabaseKey(`${DATABASE_KEY_SERVICE}:${suffix}`);
        return new Storage({ name: `${DATABASE_NAME}-${suffix}`, encryptionKey });
      })();
      this.stores.set(scope, pending);
      pending.catch(() => {
        if (this.stores.get(scope) === pending) this.stores.delete(scope);
      });
      store = pending;
    }
    return store;
  }

  private legacyStore(): Promise<Storage | null> {
    if (!this.legacyStorePromise) {
      const pending = (async () => {
        const saved = await Keychain.getGenericPassword({ service: LEGACY_KEY_SERVICE });
        if (!saved || typeof saved === 'boolean') return null;
        return new Storage({ name: LEGACY_DATABASE_NAME, encryptionKey: saved.password });
      })();
      this.legacyStorePromise = pending;
      pending.catch(() => {
        if (this.legacyStorePromise === pending) this.legacyStorePromise = null;
      });
    }
    return this.legacyStorePromise;
  }

  async getItem(key: string): Promise<string | undefined> {
    const operation = this.migrationQueue.then(async () => {
      const scoped = await this.storeFor(accountScope(key));
      const current = await scoped.getItem(key);
      if (current !== undefined) return current;

      // Move only the signed-in account's old record from the former shared DB.
      const legacy = await this.legacyStore();
      if (!legacy) return undefined;
      const value = await legacy.getItem(key);
      if (value === undefined) return undefined;
      await scoped.setItem(key, value);
      await legacy.removeItem(key);
      return value;
    });
    this.migrationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async setItem(key: string, value: string): Promise<void> {
    const scoped = await this.storeFor(accountScope(key));
    await scoped.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    const scoped = await this.storeFor(accountScope(key));
    await scoped.removeItem(key);
    const legacy = await this.legacyStore();
    if (legacy) await legacy.removeItem(key);
  }
}

export async function createLocalStore(): Promise<LocalStore> {
  if (!isSQLCipher()) {
    throw new Error('Encrypted local storage is unavailable in this app build. Please install a supported, up-to-date app build.');
  }
  return new AccountScopedNativeStore();
}
