export {};

declare global {
  interface Window {
    teddyBudDesktop?: {
      readonly isDesktop: true;
      openExternal(url: string): Promise<void>;
      loadSession(): Promise<string | null>;
      saveSession(serializedSession: string): Promise<void>;
      clearSession(): Promise<void>;
      onAuthCallback(listener: (callbackUrl: string) => void): () => void;
    };
  }
}
