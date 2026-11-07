import {
  extractTeddyStickerResponse,
  getTeddySticker,
  inferTeddySticker,
  isTeddyStickerId,
  stripTeddyStickerMarker,
} from '../src/services/stickers';

describe('Teddy sticker protocol', () => {
  test('extracts a valid marker and keeps the assistant reply clean', () => {
    expect(extractTeddyStickerResponse('You did it!\n[[TEDDY_STICKER:celebrate]]')).toEqual({
      text: 'You did it!',
      stickerId: 'celebrate',
    });
  });

  test('removes unknown marker IDs without rendering an unknown asset', () => {
    expect(extractTeddyStickerResponse('Hello\n[[TEDDY_STICKER:unknown]]')).toEqual({ text: 'Hello' });
    expect(isTeddyStickerId('unknown')).toBe(false);
  });

  test('does not alter ordinary replies', () => {
    expect(extractTeddyStickerResponse('I am here with you.')).toEqual({ text: 'I am here with you.' });
  });

  test('hides complete and partial markers while a reply streams', () => {
    expect(stripTeddyStickerMarker('That is lovely.\n[[TEDDY_STICKER:heart]]')).toBe('That is lovely.');
    expect(stripTeddyStickerMarker('That is lovely.\n[[TEDDY_STICKER:hea')).toBe('That is lovely.');
  });

  test.each([
    ['Hello Teddy!', 'wave'],
    ['I passed my exam today!', 'celebrate'],
    ['I am so tired, good night.', 'sleepy'],
    ['I feel lonely today.', 'sad'],
    ['Can you explain this? I am confused.', 'curious'],
    ['I am stressed and overwhelmed.', 'cozy'],
    ['Thank you so much, I appreciate you.', 'hug'],
  ])('infers a restrained¶»§q«^