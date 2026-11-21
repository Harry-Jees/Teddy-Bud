import { Platform } from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { FileSystem } from 'react-native-file-access';

export async function savePlainTextFile(contents: string, filename: string): Promise<boolean> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Text file downloads are unavailable in this browser.');
  }
  const objectUrl = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  }
  return true;
}

export async function saveBackupFile(contents: string): Promise<boolean> {
  if (typeof document === 'undefined') throw new Error('File downloads are unavailable in this browser.');
  const objectUrl = URL.createObjectURL(new Blob([contents], { type: 'application/vnd.teddybud+json' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `teddy-bud-${new Date().toISOString().slice(0, 10)}.tdbot`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
  return true;
}

export async function pickBackupFile(maxBytes: number): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('File selection is unavailable in this browser.');
    return new Promise((resolve, reject) => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = '.tdbot,.teddybud,application/vnd.teddybud+json,application/json';
      picker.onchange = () => {
        const file = picker.files?.[0];
        if (!file) { resolve(null); return; }
        if (file.size > maxBytes) { reject(new Error('This file is larger than the supported 25 MB limit. Your saved data was not changed.')); return; }
        file.text().then(resolve, reject);
      };
      picker.click();
    });
  }
  try {
    const selected = await pick({ type: [types.allFiles], allowMultiSelection: false });
    const file = selected[0];
    if (!file?.uri) return null;
    if (typeof file.size === 'number' && file.size > maxBytes) {
      throw new Error('This file is larger than the supported 25 MB limit. Your saved data was not changed.');
    }
    const contents = await FileSystem.readFile(file.uri, 'utf8');
    if (contents.length > maxBytes * 2) throw new Error('This file is larger than the supported 25 MB limit. Your saved data was not changed.');
    return contents;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}
