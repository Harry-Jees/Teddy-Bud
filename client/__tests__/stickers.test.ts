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

  test('normalizes legacy sticker markers for existing conversations', () => {
    expect(extractTeddyStickerResponse('That is funny.\n[[TEDDY_STICKER:giggle]]')).toEqual({
      text: 'That is funny.',
      stickerId: 'bashful',
    });
    expect(getTeddySticker('cozy').label).toBe('Cool Teddy');
    expect(getTeddySticker('heart').label).toBe('Peeking Teddy');
  });

  test('removes unknown marker IDs without rendering an unknown asset', () => {
    expect(extractTeddyStickerResponse('Hello\n[[TEDDY_STICKER:unknown]]')).toEqual({ text: 'Hello' });
    expect(isTeddyStickerId('unknown')).toBe(false);
  });

  test('does not alter ordinary replies', () => {
    expect(extractTeddyStickerResponse('I am here with you.')).toEqual({ text: 'I am here with you.' });
  });

  test('hides complete and partial markers while a reply streams', () => {
    expect(stripTeddyStickerMarker('That is lovely.\n[[TEDDY_STICKER:peek]]')).toBe('That is lovely.');
    expect(stripTeddyStickerMarker('That is lovely.\n[[TEDDY_STICKER:pea')).toBe('That is lovely.');
  });

  test.each([
    ['Hello Teddy!', 'wave'],
    ['I passed my exam today!', 'celebrate'],
    ['I am so tired, good night.', 'sleepy'],
    ['I feel lonely today.', 'sad'],
    ['Can you explain this? I am confused.', 'curious'],
    ['That is such a funny joke!', 'bashful'],
    ['You are the best!', 'cool'],
    ['Thank you so much, I appreciate you.', 'hug'],
    ['Are you there?', 'peek'],
  ])('infers a restrained contextual sticker for %s', (message, expected) => {
    expect(inferTeddySticker(message)).toBe(expected);
  });

  test('does not add a sticker to neutral messages', () => {
    expect(inferTeddySticker('What is the capital of France?')).toBeUndefined();
  });

  test('maps all nine new designs to separate bundled images', () => {
    expect(getTeddySticker('wave').label).toBe('Waving Teddy');
    expect(getTeddySticker('hug').label).toBe('Teddy hugging a heart');
    expect(getTeddySticker('bashful').label).toBe('Bashful Teddy');
    expect(getTeddySticker('curious').label).toBe('Curious Teddy');
    expect(getTeddySticker('sleepy').label).toBe('Sleepy Teddy');
    expect(getTeddySticker('celebrate').label).toBe('Celebrating Teddy');
    expect(getTeddySticker('sad').label).toBe('Tearful Teddy');
    expect(getTeddySticker('cool').label).toBe('Cool Teddy');
    expect(getTeddySticker('peek').label).toBe('Peeking Teddy');
  });
});
