import { NativeModules, Platform } from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { FileSystem } from 'react-native-file-access';

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const IMAGE_PROCESSOR = NativeModules.TeddyBudImageProcessor as {
  compress?: (uri: string, maxDimension: number, quality: number) => Promise<string>;
} | undefined;

export type PickedChatImage = { dataUrl: string; name: string };

function mimeForFile(type?: string | null, name?: string | null): string | null {
  const normalized = type?.split(';')[0]?.trim().toLowerCase();
  const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (normalized && supported.has(normalized)) return normalized;
  const extension = name?.split('.').pop()?.toLowerCase();
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  };
  return extension ? byExtension[extension] ?? null : null;
}

function decodedBytes(base64: string): number {
  return Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

export async function pickChatImage(): Promise<PickedChatImage | null> {
  try {
    const selected = await pick({ type: [types.images], allowMultiSelection: false });
    const file = selected[0];
    if (!file?.uri) return null;
    if (typeof file.size === 'number' && file.size > MAX_SOURCE_BYTES) {
      throw new Error('This source image is larger than 100 MB and cannot be processed safely.');
    }

    // Android document providers often report application/octet-stream even
    // for ordinary JPEG/PNG files. Prefer a recognized extension in that case.
    const mime = mimeForFile(file.type, file.name);
    if (!mime) throw new Error('This image format is not supported. Choose a JPEG, PNG, WebP, GIF, or HEIC image.');

    if (IMAGE_PROCESSOR?.compress) {
      const base64 = await IMAGE_PROCESSOR.compress(file.uri, 2560, 86);
      if (!base64 || decodedBytes(base64) > MAX_UPLOAD_BYTES) {
        throw new Error('The image could not be reduced to a supported upload size. Please choose another image.');
      }
      return { dataUrl: `data:image/jpeg;base64,${base64}`, name: file.name || 'image.jpg' };
    }

    const base64 = await FileSystem.readFile(file.uri, 'base64');
    if (decodedBytes(base64) > MAX_UPLOAD_BYTES) {
      throw new Error('Image processing is unavailable in this build. Update Teddy Bud to resize this image automatically.');
    }
    return { dataUrl: `data:${mime};base64,${base64}`, name: file.name || 'image' };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}
