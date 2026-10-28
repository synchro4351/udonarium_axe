/**
 * The effect token written into a line of chat.
 *
 * Written after the roll and the damage, the effect plays after both.
 * The double brackets are free in the chat notation, as the novel mode's own brackets
 * are, so they collide with neither the dice nor the resource changes. The reading of a ruby
 * (`|word《reading》`) is written in the same brackets, so it is never taken for a token.
 */

import { rubyNotationRuns } from '@axe/domain/chat/ruby-notation';

const TOKEN_PATTERN = /《([^《》]+)》/g;

export interface EffectChatToken {
  /** The name of the effect called for. */
  name: string;
  /** The line with the token taken out. */
  text: string;
}

/**
 * The token that plays a line as an exchange on the battle stage rather than naming an effect.
 * Read in either width and either case.
 */
export const BATTLE_CHAT_TOKEN = '《vs》';

/** Whether a token's name is the battle stage's own rather than an effect's. */
export function isBattleChatTokenName(name: string): boolean {
  return name.normalize('NFKC').trim().toLowerCase() === 'vs';
}

/**
 * Takes the first effect token out of a line. Null when there is none. The battle stage's token
 * names no effect, so it is passed over.
 */
export function parseEffectChatToken(text: string): EffectChatToken | null {
  for (const run of rubyNotationRuns(text)) {
    if (run.reading.length > 0) continue;
    for (const matched of run.raw.matchAll(TOKEN_PATTERN)) {
      const name = matched[1].trim();
      if (name.length < 1) return null;
      if (isBattleChatTokenName(name)) continue;

      return { name, text: stripEffectChatTokens(text) };
    }
  }
  return null;
}

/** Whether a line asks to be played on the battle stage, by the battle stage's token anywhere in it. */
export function hasBattleChatToken(text: string): boolean {
  return rubyNotationRuns(text).some(
    (run) =>
      run.reading.length === 0 && [...run.raw.matchAll(TOKEN_PATTERN)].some((token) => isBattleChatTokenName(token[1]))
  );
}

/** Takes every effect token out of a line, leaving its rubies as they are. */
export function stripEffectChatTokens(text: string): string {
  return rubyNotationRuns(text)
    .map((run) =>
      run.reading.length > 0 ? run.raw : run.raw.replace(TOKEN_PATTERN, '').replace(/[\s\u3000]{2,}/g, ' ')
    )
    .join('')
    .trim();
}

/** The token added to a palette row. */
export function buildEffectChatToken(name: string): string {
  return `《${name}》`;
}
