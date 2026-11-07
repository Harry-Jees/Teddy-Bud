import { Platform } from 'react-native';
import { browserAuthService } from './browserAuth';
import { DEFAULT_ASSISTANT_CHARACTER_ID, getAssistantCharacter } from '../characters';
import type { AssistantCharacterId } from '../characters';
import type { StoredSession } from './session';

export type GatewayMessageRole = 'user' | 'assistant' | 'system';
export type GatewayContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };
export interface GatewayMessage { role: GatewayMessageRole; content: string | GatewayContentPart[]; }
export type GatewayCapability = 'coding' | 'vision' | 'web_search';
export interface GatewayModel { id: string; name?: string; capabilities: GatewayCapability[]; }
export interface SendChatOptions { modelId?: string; task?: 'conversation' | 'coding' | 'vision'; imageDataUrl?: string; enableWebBrowsing?: boolean; memories?: string[]; crossChatContext?: string[]; aboutMe?: string; assistantName?: string; assistantCharacterId?: AssistantCharacterId; crisisConcern?: boolean; onTextChunk?: (text: string) => void; signal?: AbortSignal; }

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 350;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_CONTEXT_CHARS = 80_000;
const MAX_SHARED_MEMORY_CHARS = 4_000;
const MAX_CROSS_CHAT_CONTEXT_CHARS = 1_800;
// Route ordinary text (including coding) to the lower-cost text model.
const PREFERRED_CHAT_MODELS = [
  '@cf/zai-org/glm-4.7-flash',
];
// Qwen is t¶»§q«^