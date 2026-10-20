import type { LocalStore } from './localStore';

const DATABASE_NAME = 'teddy-bud-local';
const DATABASE_VERSION = 2;
const OBJECT_STORE_NAME = 'key-value';
const KEY_STORE_NAME = 'crypto-keys';
const KEY_ID = 'local-data-encryption-key';
const WEB_ENVELOPE_PREFIX = 'teddybud-web-encrypted:v2:';
const WEB_LEGACY_ENVELOPE_PREFIX = 'teddybud-web-encrypted:v1:';
const DESKTOP_ENVELOPE_PREFIX = 'teddybud-desktop-encrypted:v2:';
const DESKTOP_LEGACY_ENVELOPE_PREFIX = 'teddybud-desktop-encrypted:v1:';

type DesktopBridge = NonNullable<Window['teddyBudDesktop']>;

function desktopBridge(): DesktopBridge | undefined {
  return typeof window !== 'undefined' && window.teddyBudDesktop?.isDesktop
    ? window.teddyBudDesktop
    : undefined;
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error('Secure local data encryption is unavailable in this browser. Update the browser and try again.');
  }
  return globalThis.crypto;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Encrypted local data has an invalid encoding.');
  }
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

class BrowserLocalStore implements LocalStore {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private readonly encryptionKeyPromises = new Map<string, Promise<CryptoKey>>();

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('This browser does not support persistent local data storage.');
    }
    if (!this.databasePromise) {
      const pending = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        let settled = false;
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
            request.result.createObjectStore(OBJECT_STORE_NAME);
          }
          if (!request.result.objectStoreNames.contains(KEY_STORE_NAME)) {
            request.result.createObjectStore(KEY_STORE_NAME);
          }
        };
        request.onsuccess = () => {
          if (settled) {
            request.result.close();
            return;
          }
          const database = request.result;
          database.onversionchange = () => database.close();
          settled = true;
          resolve(database);
        };
        request.onerror = () => {
          if (!settled) {
            settled = true;
            reject(request.error ?? new Error('The local database could not be opened.'));
          }
        };
        request.onblocked = () => {
          if (!settled) {
            settled = true;
            reject(new Error('The local database is busy in another tab. Close other Teddy Bud tabs and retry.'));
          }
        };
      });
      this.databasePromise = pending;
      pending.catch(() => {
        if (this.databasePromise === pending) this.databasePromise = null;
      });
    }
    return this.databasePromise;
  }

  private async execute<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let result: T;
      let hasResult = false;
      let settled = false;
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      let request: IDBRequest<T>;
      try {
        request = operation(transaction.objectStore(storeName));
      } catch (error) {
        fail(error instanceof Error ? error : new Error('The local database request failed.'));
        return;
      }
      request.onsuccess = () => {
        result = request.result;
        hasResult = true;
      };
      request.onerror = () => fail(request.error ?? new Error('The local database request failed.'));
      transaction.oncomplete = () => {
        if (!hasResult) {
          fail(new Error('The local database transaction completed without a result.'));
          return;
        }
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      transaction.onerror = () => fail(transaction.error ?? new Error('The local database transaction failed.'));
      transaction.onabort = () => fail(transaction.error ?? new Error('The local database transaction was aborted.'));
    });
  }

  private getEncryptionKey(keyName: string, legacy = false): Promise<CryptoKey> {
    const scope = legacy ? 'legacy-shared-key' : keyName;
    let existing = this.encryptionKeyPromises.get(scope);
    if (!existing) {
      const pending = (async () => {
        const candidate = await cryptoApi().subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        );
        const database = await this.openDatabase();
        return new Promise<CryptoKey>((resolve, reject) => {
          const transaction = database.transaction(KEY_STORE_NAME, 'readwrite');
          const store = transaction.objectStore(KEY_STORE_NAME);
          let key: CryptoKey | undefined;
          let settled = false;
          const scopedId = legacy ? KEY_ID : `${KEY_ID}:${keyName}`;
          const read = store.get(scopedId) as IDBRequest<CryptoKey | undefined>;
          read.onsuccess = () => {
            key = read.result ?? candidate;
            if (!read.result) store.put(candidate, scopedId);
          };
          read.onerror = () => {
            if (settled) return;
            settled = true;
            reject(read.error ?? new Error('The local encryption key could not be loaded.'));
          };
          transaction.oncomplete = () => {
            if (settled) return;
            settled = true;
            if (key) resolve(key);
            else reject(new Error('The local encryption key could not be created.'));
          };
          transaction.onerror = () => {
            if (settled) return;
            settled = true;
            reject(transaction.error ?? new Error('The local encryption key could not be saved.'));
          };
          transaction.onabort = () => {
            if (settled) return;
            settled = true;
            reject(transaction.error ?? new Error('The local encryption key transaction was aborted.'));
          };
        });
      })();
      this.encryptionKeyPromises.set(scope, pending);
      pending.catch(() => {
        if (this.encryptionKeyPromises.get(scope) === pending) this.encryptionKeyPromises.delete(scope);
      });
      existing = pending;
    }
    return existing;
  }

  private async encrypt(keyName: string, value: string): Promise<string> {
    const bridge = desktopBridge();
    if (bridge) {
      return `${DESKTOP_ENVELOPE_PREFIX}${await bridge.encryptLocalData(keyName, value)}`;
    }

    const crypto = cryptoApi();
    const key = await this.getEncryptionKey(keyName);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const additionalData = new TextEncoder().encode(keyName);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData },
      key,
      new TextEncoder().encode(value),
    );
    const payload = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    payload.set(iv);
    payload.set(new Uint8Array(ciphertext), iv.byteLength);
    return `${WEB_ENVELOPE_PREFIX}${encodeBase64(payload)}`;
  }

  private async decrypt(keyName: string, value: string): Promise<string> {
    if (value.startsWith(DESKTOP_ENVELOPE_PREFIX)) {
      const bridge = desktopBridge();
      if (!bridge) throw new Error('This local data was encrypted by the Teddy Bud desktop app. Open it in that app to read it.');
      return bridge.decryptLocalData(keyName, value.slice(DESKTOP_ENVELOPE_PREFIX.length));
    }
    if (value.startsWith(DESKTOP_LEGACY_ENVELOPE_PREFIX)) {
      const bridge = desktopBridge();
      if (!bridge) throw new Error('This local data was encrypted by the Teddy Bud desktop app. Open it in that app to read it.');
      return bridge.decryptLegacyLocalData(value.slice(DESKTOP_LEGACY_ENVELOPE_PREFIX.length));
    }
    const legacyWeb = value.startsWith(WEB_LEGACY_ENVELOPE_PREFIX);
    if (!legacyWeb && !value.startsWith(WEB_ENVELOPE_PREFIX)) return value;

    const prefix = legacyWeb ? WEB_LEGACY_ENVELOPE_PREFIX : WEB_ENVELOPE_PREFIX;
    const payload = decodeBase64(value.slice(prefix.length));
    if (payload.byteLength < 12 + 16) throw new Error('Encrypted local data is incomplete.');
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(keyName) },
      await this.getEncryptionKey(keyName, legacyWeb),
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  }

  private async encryptLegacyRecord(key: string, legacyValue: string, plaintext: string): Promise<void> {
    const encrypted = await this.encrypt(key, plaintext);
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
      let settled = false;
      const read = transaction.objectStore(OBJECT_STORE_NAME).get(key);
      read.onsuccess = () => {
        if (read.result === legacyValue) transaction.objectStore(OBJECT_STORE_NAME).put(encrypted, key);
      };
      read.onerror = () => {
        if (settled) return;
        settled = true;
        reject(read.error ?? new Error('The saved local data could not be migrated.'));
      };
      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      transaction.onerror = () => {
        if (settled) return;
        settled = true;
        reject(transaction.error ?? new Error('The saved local data could not be migrated.'));
      };
      transaction.onabort = () => {
        if (settled) return;
        settled = true;
        reject(transaction.error ?? new Error('The saved local data migration was aborted.'));
      };
    });
  }

  async getItem(key: string): Promise<string | undefined> {
    const saved = await this.execute<string | undefined>(
      OBJECT_STORE_NAME,
      'readonly',
      store => store.get(key),
    );
    if (saved === undefined) return undefined;
    const plaintext = await this.decrypt(key, saved);
    // Encrypt existing plaintext records on first read after this upgrade.
    if (saved.startsWith(WEB_LEGACY_ENVELOPE_PREFIX) || saved.startsWith(DESKTOP_LEGACY_ENVELOPE_PREFIX)
      || (!saved.startsWith(WEB_ENVELOPE_PREFIX) && !saved.startsWith(DESKTOP_ENVELOPE_PREFIX))) {
      await this.encryptLegacyRecord(key, saved, plaintext);
    }
    return plaintext;
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await this.execute<IDBValidKey>(OBJECT_STORE_NAME, 'readwrite', store => store.put(encrypted, key));
  }

  async removeItem(key: string): Promise<void> {
    await this.execute<undefined>(OBJECT_STORE_NAME, 'readwrite', store => store.delete(key));
  }
}

export async function createLocalStore(): Promise<LocalStore> {
  return new BrowserLocalStore();
}
