import { Platform } from 'react-native';
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { FileSystem } from 'react-native-file-access';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

export type PickedChatImage = { dataUrl: string; name: string };

export async function pickChatImage(): Promise<PickedChatImage | null> {
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('Image selection is unavailable on this device.');
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        if (file.size > MAX_IMAGE_BYTES) {
          reject(new Error('Choose an image smaller than 12 MB.'));
          return;
        }
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
          reject(new Error('Choose a JPEG, PNG, WebP, or GIF image.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve({ dataUrl: reader.result, name: file.name })
          : reject(new Error('The selected image could not be read.'));
        reader.onerror = () => reject(new Error('The selected image could not be read.'));
        reader.readAsDataURL(file);
      };
      input.click();
    });
  }

  try {
    const selected = await pick({ type: [types.images], allowMultiSelection: false });
    const file = selected[0];
    if (!file?.uri) return null;
    if (typeof file.size === 'number' && file.size > MAX_IMAGE_BYTES) {
      throw new Error('Choose an image smaller than 12 MB.');
    }
    const extension = file.name?.split('.').pop()?.toLowerCase();
    const mimeByExtension: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const mime = file.type?.toLowerCase() || (extension ? mimeByExtension[extension] : undefined);
    if (!mime || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
      throw new Error('This image format is not supported. Choose a JPEG, PNG, WebP, or GIF image.');
    }
    const base64 = await FileSystem.readFile(file.uri, 'base64');
    // Some Android document providers omit the file size. Check the actual
    // decoded payload length before creating a large data URL or sending it.
    const estimatedBytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      throw new Error('Choose an image smaller than 12 MB.');
    }
    return { dataUrl: `data:${mime};base64,${base64}`, name: file.name || 'image' };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}
