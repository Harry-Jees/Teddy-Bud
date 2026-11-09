export async function savePlainTextFile(contents: string, filename: string): Promise<boolean> {
  const safeFileName = filename.toLowerCase().endsWith('.txt') ? filename : `${filename}.txt`;
  const path = `${Dirs.CacheDir}/${safeFileName}`;
  await FileSystem.writeFile(path, contents);
  try {
    const [result] = await saveDocuments({
      sourceUris: [`file://${encodeURI(path)}`],
      fileName: safeFileName,
      mimeType: 'text/plain',
      copy: true,
    });
    if (result.error) throw new Error('The text file could not be prepared for export.');
    return true;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return false;
    throw error;
  } finally {
    await FileSystem.unlink(path).catch(() => undefined);
  }
}

import { errorCodes, isErrorWithCode, keepLocalCopy, pick, saveDocuments, types } from '@react-native-documents/picker';
import type { DocumentPickerResponse } from '@react-native-documents/picker';
import { Dirs, FileSystem } from 'react-native-file-access';

export async function saveBackupFile(contents: string): Promise<boolean> {
  const fileName = `teddy-bud-${new Date().toISOString().slice(0, 10)}.teddybud`;
  const path = `${Dirs.CacheDir}/${fileName}`;
  await FileSystem.writeFile(path, contents);
  try {
    const [result] = await saveDocuments({
      sourceUris: [`file://${encodeURI(path)}`],
      fileName,
      mimeType: 'application/vnd.teddybud+json',
      copy: true,
    });
    if (result.error) throw new Error(result.error);
    return true;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return false;
    throw error;
  } finally {
    await FileSystem.unlink(path).catch(() => undefined);
  }
}

export async function pickBackupFile(maxBytes: number): Promise<string | null> {
  let selected: DocumentPickerResponse | undefined;
  try {
    [selected] = await pick({ type: [types.json, 'application/vnd.teddybud+json'], mode: 'import' });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
  if (selected.size !== null && selected.size > maxBytes) {
    throw new Error('This file is larger than the supported 25 MB limit. Your saved data was not changed.');
  }
  const [copy] = await keepLocalCopy({
    files: [{ uri: selected.uri, fileName: selected.name ?? 'teddy-bud-backup.teddybud' }],
    destination: 'cachesDirectory',
  });
  if (copy.status === 'error') throw new Error(`Could not read the selected backup: ${copy.copyError}`);
  const path = decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''));
  try {
    const contents = await FileSystem.readFile(path);
    if (new TextEncoder().encode(contents).byteLength > maxBytes) {
      throw new Error('This file is larger than the supported 25 MB limit. Your saved data was not changed.');
    }
    return contents;
  } finally {
    await FileSystem.unlink(path).catch(() => undefined);
  }
}
