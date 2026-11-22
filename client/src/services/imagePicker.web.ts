export type PickedChatImage = { dataUrl: string; name: string };

const MAX_SOURCE_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 2560;

async function prepareImage(file: File): Promise<string> {
  if (typeof createImageBitmap !== 'function') throw new Error('This browser cannot prepare images for upload. Try a recent version of Chrome, Edge, or Firefox.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The image could not be prepared for upload.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.8, 0.74, 0.68, 0.6]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Length = dataUrl.length - dataUrl.indexOf(',') - 1;
      if (Math.floor(base64Length * 3 / 4) <= MAX_UPLOAD_BYTES) return dataUrl;
    }
    throw new Error('This image could not be reduced to a supported upload size.');
  } finally {
    bitmap.close();
  }
}

export async function pickChatImage(): Promise<PickedChatImage | null> {
  if (typeof document === 'undefined') throw new Error('Image selection is unavailable on this device.');
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > MAX_SOURCE_BYTES) {
        reject(new Error('This source image is larger than 100 MB and cannot be processed safely.'));
        return;
      }
      if (!file.type.toLowerCase().startsWith('image/')) {
        reject(new Error('Choose a valid image file.'));
        return;
      }
      prepareImage(file).then(dataUrl => resolve({ dataUrl, name: file.name || 'image' })).catch(reject);
    };
    input.onerror = () => reject(new Error('The image picker could not be opened.'));
    input.click();
  });
}
