import type { ImageSourcePropType } from 'react-native';

export const TEDDY_STICKER_IDS = [
  'wave', 'hug', 'bashful', 'curious', 'sleepy', 'celebrate', 'sad', 'cool', 'peek',
] as const;

export type CanonicalTeddyStickerId = (typeof TEDDY_STICKER_IDS)[number];
export type LegacyTeddyStickerId = 'giggle' | 'cozy' | 'heart';
export type TeddyStickerId = CanonicalTeddyStickerId | LegacyTeddyStickerId;

type TeddySticker = { label: string; source: ImageSourcePropType };

const STICKERS: Record<CanonicalTeddyStickerId, TeddySticker> = {
  wave: { label: 'Waving Teddy', source: require('../../assets/stickers/teddy-sticker-01.webp') },
  hug: { label: 'Teddy hugging a heart', source: require('../../assets/stickers/teddy-sticker-02.webp') },
  bashful: { label: 'Bashful Teddy', source: require('../../assets/stickers/teddy-sticker-03.webp') },
  curious: { label: 'Curious Teddy', source: require('../../assets/stickers/teddy-sticker-04.webp') },
  sleepy: { label: 'Sleepy Teddy', source: require('../../assets/stickers/teddy-sticker-05.webp') },
  celebrate: { label: 'Celebrating Teddy', source: require('../../assets/stickers/teddy-sticker-06.webp') },
  sad: { label: 'Tearful Teddy', source: require('../../assets/stickers/teddy-sticker-07.webp') },
  cool: { label: 'Cool Teddy', source: require('../../assets/stickers/teddy-sticker-08.webp') },
  peek: { label: 'Peeking Teddy', source: require('../../assets/stickers/teddy-sticker-09.webp') },
};

const LEGACY_STICKER_IDS: Record<LegacyTeddyStickerId, CanonicalTeddyStickerId> = {
  giggle: 'bashful',
  cozy: 'cool',
  heart: 'peek',
};

const STICKER_MARKER = /\s*\[\[TEDDY_STICKER:([a-z-]+)\]\]\s*$/i;

export function isTeddyStickerId(value: unknown): value is TeddyStickerId {
  return typeof value === 'string'
    && ((TEDDY_STICKER_IDS as readonly string[]).includes(value)
      || Object.prototype.hasOwnProperty.call(LEGACY_STICKER_IDS, value));
}

export function getTeddySticker(id: TeddyStickerId): TeddySticker {
  const canonicalId = (LEGACY_STICKER_IDS as Partial<Record<TeddyStickerId, CanonicalTeddyStickerId>>)[id] ?? id as CanonicalTeddyStickerId;
  return STICKERS[canonicalId];
}

export function extractTeddyStickerResponse(response: string): { text: string; stickerId?: CanonicalTeddyStickerId } {
  const match = STICKER_MARKER.exec(response);
  if (!match || match.index === undefined) return { text: response.trimEnd() };
  const stickerId = match[1].toLowerCase();
  if (!isTeddyStickerId(stickerId)) return { text: response.slice(0, match.index).trimEnd() };
  const canonicalId = (LEGACY_STICKER_IDS as Partial<Record<TeddyStickerId, CanonicalTeddyStickerId>>)[stickerId as TeddyStickerId]
    ?? stickerId as CanonicalTeddyStickerId;
  return { text: response.slice(0, match.index).trimEnd(), stickerId: canonicalId };
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

export function inferTeddySticker(userMessage: string): CanonicalTeddyStickerId | undefined {
  const text = userMessage.trim().toLowerCase();
  if (!text) return undefined;
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|bye|goodbye)( teddy| there)?[!.,\s]*$/.test(text)) return 'wave';
  if (/\b(good night|going to bed|time to sleep|i am sleepy|i'm sleepy|so tired)\b/.test(text)) return 'sleepy';
  if (/\b(passed|got selected|won|achievement|i did it|finished my|finally completed|proud of myself)\b/.test(text)) return 'celebrate';
  if (/\b(joke|that is funny|that's funny|haha|hahaha|lol|made me laugh)\b/.test(text)) return 'bashful';
  if (/\b(confused|don't understand|do not understand|not sure what|what does .* mean|can you explain)\b/.test(text)) return 'curious';
  if (/\b(sad|crying|i feel lonely|feeling lonely|i feel upset|feeling upset|miss them)\b/.test(text)) return 'sad';
  if (/\b(you are the best|you're the best|that means a lot|sending a heart|looking cool|that's cool|so cool|nice outfit)\b/.test(text)) return 'cool';
  if (/\b(stressed|anxious|overwhelmed|need to calm down|help me relax|need some calm|love you|sending love|thank you|thanks so much|i appreciate you|need a hug|virtual hug)\b/.test(text)) return 'hug';
  if (/\b(are you there|where are you|just checking in|peek|boo)\b/.test(text)) return 'peek';
  return undefined;
}
