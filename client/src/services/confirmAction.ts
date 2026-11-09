/** Platform-aware confirmation for destructive or privacy-sensitive actions. */
import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, message: string, onConfirm: () => void): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert -- confirmation protects destructive local-data actions.
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}
