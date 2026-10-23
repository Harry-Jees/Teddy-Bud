export type PickedChatImage = { dataUrl: string; name: string };

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function pickChatImage(): Promise<PickedChatImage | null> {
  if (typeof document === 'undefined') throw new Error('Image selection is unavailable on this device.');
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [...ALLOWED_TYPES].join(',');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > MAX_IMAGE_BYTES) {
        reject(new Error('Choose an image smaller than 8 MB.'));
        return;
      }
      if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
        reject(new Error('Choose a JPEG, PNG, WebP, or GIF image.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve({ dataUrl: reader.result, name: file.name || 'image' })
        : reject(new Error('The selected image could not be read.'));
      reader.onerror = () => reject(new Error('The selected image could not be read.'));
      reader.readAsDataURL(file);
    };
    input.onerror = () => reject(new Error('The image picker could not be opened.'));
    input.click();
  });
}
