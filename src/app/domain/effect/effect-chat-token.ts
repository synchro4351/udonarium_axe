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

/** Takes the first effect token out of a line. Null when there is none. */
export function parseEffectChatToken(text: string): EffectChatToken | null {
  for (const run of rubyNotationRuns(text)) {
    if (run.reading.length > 0) continue;
    TOKEN_PATTERN.lastIndex = 0;
    const matched = TOKEN_PATTERN.exec(run.raw);
    if (!matched) continue;

    const name = matched[1].trim();
    if (name.length < 1) return null;

    return { name, text: stripEffectChatTokens(text) };
  }
  return null;
}

/** Takes every effect token out of a line, leaving ruby as it is. */
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
