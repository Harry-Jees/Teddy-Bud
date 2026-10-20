export {};

declare global {
  interface Window {
    teddyBudDesktop?: {
      readonly isDesktop: true;
      openExternal(url: string): Promise<void>;
      loadSession(): Promise<string | null>;
      saveSession(serializedSession: string): Promise<void>;
      clearSession(): Promise<void>;
      encryptLocalData(keyName: string, value: string): Promise<string>;
      decryptLocalData(keyName: string, value: string): Promise<string>;
      decryptLegacyLocalData(value: string): Promise<string>;
      onAuthCallback(listener: (callbackUrl: string) => void): () => void;
    };
  }
}
