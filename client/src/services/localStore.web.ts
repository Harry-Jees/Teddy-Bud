import type { LocalStore } from './localStore';

const DATABASE_NAME = 'teddy-bud-local';
const OBJECT_STORE_NAME = 'key-value';

class BrowserLocalStore implements LocalStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private openDatabase(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('This browser does not support persistent local data storage.');
    }
    if (!this.databasePromise) {
      const pending = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        let settled = false;
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
            request.result.createObjectStore(OBJECT_STORE_NAME);
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
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.openDatabase();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(OBJECT_STORE_NAME, mode);
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
        request = operation(transaction.objectStore(OBJECT_STORE_NAME));
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

  getItem(key: string): Promise<string | undefined> {
    return this.execute('readonly', store => store.get(key));
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.execute('readwrite', store => store.put(value, key));
  }

  async removeItem(key: string): Promise<void> {
    await this.execute('readwrite', store => store.delete(key));
  }
}

export async function createLocalStore(): Promise<LocalStore> {
  return new BrowserLocalStore();
}
