import { replaceRubyNotation } from '@axe/domain/chat/ruby-notation';

export interface SpeechSettings {
  voiceURI: string;
  rate: number;
  volume: number;
  readSelf: boolean;
  duckBgm: boolean;
  duckLevel: number;
  remoteVoices: boolean;
  tabs: Record<string, boolean>;
}

export const SPEECH_STORAGE_KEY = 'chat-speech-preferences';

export function readSpeechSettings(value: unknown): SpeechSettings {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const tabs: Record<string, boolean> = Object.create(null);
  if (source['tabs'] && typeof source['tabs'] === 'object') {
    for (const [name, enabled] of Object.entries(source['tabs'])
      .filter(([, value]) => typeof value === 'boolean')
      .slice(-64)) {
      if (typeof enabled === 'boolean') tabs[name] = enabled;
    }
  }
  const bounded = (key: string, fallback: number, min: number, max: number) => {
    const n = source[key];
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  return {
    voiceURI: typeof source['voiceURI'] === 'string' ? source['voiceURI'] : '',
    rate: bounded('rate', 1, 0.5, 2),
    volume: bounded('volume', 1, 0, 1),
    readSelf: source['readSelf'] !== false,
    duckBgm: source['duckBgm'] === true,
    duckLevel: bounded('duckLevel', 0.25, 0, 1),
    remoteVoices: source['remoteVoices'] === true,
    tabs,
  };
}

/** Read ruby pronunciations and omit markup and URLs without interpreting HTML. */
export function speechText(text: string): string {
  return replaceRubyNotation(text, (_base, reading) => reading)
    .replace(/https?:\/\/[^\s<>]+/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What is read aloud for a message: its words, or for a stamp sent without any, the stamp's name,
 * which is its first search word.
 */
export function messageSpeechText(message: {
  readonly text: string | null | undefined;
  readonly stampName?: string | null;
}): string {
  const text = speechText(message.text ?? '');
  return text.length > 0 ? text : speechText(message.stampName ?? '');
}

/** Keep the complete message and never split a Unicode code point. */
export function speechChunks(text: string): string[] {
  const characters = Array.from(text);
  const chunks: string[] = [];
  for (let i = 0; i < characters.length; i += 160) chunks.push(characters.slice(i, i + 160).join(''));
  return chunks;
}
