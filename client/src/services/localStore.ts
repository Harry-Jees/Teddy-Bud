export type LocalStore = {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export async function createLocalStore(): Promise<LocalStore> {
  throw new Error('Local storage is unavailable on this platform.');
}
