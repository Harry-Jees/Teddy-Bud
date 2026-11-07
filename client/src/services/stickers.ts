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
  return typeof value ===¶»§q«^