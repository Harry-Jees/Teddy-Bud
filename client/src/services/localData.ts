import { createLocalStore } from './localStore';
import type { LocalStore } from './localStore';
import { ASSISTANT_CHARACTERS, DEFAULT_ASSISTANT_CHARACTER_ID, getAssistantCharacter } from '../characters';
import type { AssistantCharacterId, AssistantCharacterNames } from '../characters';

export type LocalMessage = {
  id: number;
  text: string;
  author: 'you' | 'teddy';
  time: string;
  imageDataUrl?: string;
  stickerId?: import('./stickers').TeddyStickerId;
};

export type LocalConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: LocalMessage[];
  pinned?: boolean;
};

export type EmotionCheckIn = {
  id: string;
  createdAt: string;
  emotions: Record<string, number>;
  energy: number;
  support: 'listen' | 'advice' | 'encouragement' | 'unsure';
  note?: string;
  origin?: 'survey-ai' | 'self';
};

export const EMOTION_AXES = [
  { id: 'happy', label: 'Happy' },
  { id: 'calm', label: 'Calm' },
  { id: 'connected', label: 'Connected' },
  { id: 'hopeful', label: 'Hopeful' },
  { id: 'energized', label: 'Energized' },
  { id: 'sad', label: 'Sad' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'angry', label: 'Angry' },
  { id: 'lonely', label: 'Lonely' },
  { id: 'overwhelmed', label: 'Overwhelmed' },
] as const;

export type LocalMemory = {
  id: number;
  text: string;
  date: string;
};

export type JournalEntry = { id: string; createdAt: string; title: string; body: string; prompt: string; };

export type LocalAppD¶»§q«^