export {};

declare global {
  interface Window {
    teddyBudDesktop?: {
      readonly isDesktop: true;
      openExternal(url: string): Promise<void>;
      loadSession(): Promise<string | null>;
      saveSession(serializedSession: string): Promise<void>;
      clearSession(): Promise<void>;
      encryptLocalData(value: string): Promise<string>;
      decryptLocalData(value: string): Promise<string>;
      onAuthCallback(listener: (callbackUrl: string) => void): () => void;
    };
  }
}
