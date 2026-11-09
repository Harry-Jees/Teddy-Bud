/** Opens external links through the desktop shell when available, otherwise through the OS/browser. */
import { Linking } from 'react-native';

export function openExternalUrl(url: string): Promise<void> {
  const desktop = typeof window !== 'undefined' ? window.teddyBudDesktop : undefined;
  return desktop ? desktop.openExternal(url) : Linking.openURL(url);
}
