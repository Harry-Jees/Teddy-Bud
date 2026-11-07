import type { ImageSourcePropType } from 'react-native';

export const TEDDY_STICKER_IDS = [
  'wave', 'giggle', 'hug', 'curious', 'sleepy', 'sad', 'celebrate', 'cozy', 'heart',
] as const;

export type TeddyStickerId = (typeof TEDDY_STICKER_IDS)[number];

type TeddySticker = { label: string; source: ImageSourcePropType };

const STICKERS: Record<TeddyStickerId, TeddySticker> = {
  wave: { label: 'Waving Teddy', source: require('../../assets/stickers/teddy-sticker-01.webp') },
  giggle: { label: 'Giggling Teddy', source: require('../../assets/stickers/teddy-sticker-02.webp') },
  hug: { label: 'Teddy holding a heart', source: require('../../assets/stickers/teddy-sticker-03.webp') },
  curious: { label: 'Curious Teddy', source: require('../../assets/stickers/teddy-sticker-04.webp') },
  sleepy: { label: 'Sleepy Teddy', source: require('../../assets/stickers/teddy-sticker-05.webp') },
  sad: { label: 'Tearful Teddy', source: require('../../assets/stickers/teddy-sticker-06.webp') },
  celebrate: { label: 'Celebrating Teddy', source: require('../../assets/stickers/teddy-sticker-07.webp') },
  cozy: { label: 'Cozy Teddy with a warm drink', source: require('../../assets/stickers/teddy-sticker-08.webp') },
  heart: { label: 'Teddy sending a heart', source: require('../../assets/stickers/teddy-sticker-09.webp') },
};

const STICKER_MARKER = /\s*\[\[TEDDY_STICKER:([a-z-]+)\]\]\s*$/i;

export function isTeddyStickerId(value: unknown): value is TeddyStickerId {
  return typeof value === 'string' && (TEDDY_STICKER_IDS as readonly string[]).includes(value);
}

export function getTeddySticker(id: TeddyStickerId): TeddySticker {
  return STICKERS[id];
}

export function extractTeddyStickerResponse(response: string): { text: string; stickerId?: TeddyStickerId } {
  const match = STICKER_MARKER.exec(response);
  if (!match || match.index === undefined) return { text: response.trimEnd() };
  const stickerId = match[1].toLowerCase();
  return {
    text: response.slice(0, match.index).trimEnd(),
    ...(isTeddyStickerId(stickerId) ? { stickerId } : {}),
  };
}

export function stripTeddyStickerMarker(text: string): string {
  const markerStart = text.lastIndexOf('[[TEDDY_STICKER');
  if (markerStart < 0) return text;
  const suffix = text.slice(markerStart);
  if (!suffix.includes(']]') || /\[\[TEDDY_STICKER:[a-z-]+\]\]\s*$/i.test(suffix)) {
    return text.slice(0, markerStart).trimEnd();
  }
  return text;
}

export function inferTeddySticker(userMessage: string): TeddyStickerId | undefined {
  const text = userMessage.trim().toLowerCase();
  if (!text) return undefined;
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|bye|goodbye)( teddy| there)?[!.,\s]*$/.test(text)) return 'wave';
  if (/\b(good night|going to bed|time to sleep|i am sleepy|i'm sleepy|so tired)\b/.test(text)) return 'sleepy';
  if (/\b(passed|got selected|won|achievement|i did it|finished my|finally completed|proud of myself)\b/.test(text)) return 'celebrate';
  if (/\b(joke|that is funny|that's funny|haha|hahaha|lol|made me laugh)\b/.test(text)) return 'giggle';
  if (/\b(confused|don't understand|do not understand|not sure what|what does .* mean|can you explain)\b/.test(text)) return 'curious';
  if (/\b(sad|crying|i feel lonely|feeling lonely|i feel upset|feeling upset|miss them)\b/.test(text)) return 'sad';
  if (/\b(stressed|anxious|overwhelmed|need to calm down|help me relax|need some calm)\b/.test(text)) return 'cozy';
  if (/\b(love you|sending love|thank you|thanks so much|i appreciate you|need a hug|virtual hug)\b/.test(text)) return 'hug';
  if (/\b(you are the best|you're the best|that means a lot|sending a heart|❤️|💛|💕)\b/.test(text)) return 'heart';
  return undefined;
}
