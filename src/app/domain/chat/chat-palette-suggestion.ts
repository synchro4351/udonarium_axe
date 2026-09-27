import { ChatPalette } from '@axe/domain/chat/chat-palette';

/** How many palette lines are offered at most, so they stay one glance long beside the stamps. */
export const MAX_PALETTE_SUGGESTIONS = 8;

/**
 * The lines of a speaker's palette that hold what is being written, in any case, in palette order.
 *
 * Nothing is offered until two characters are written, as the palette panel's own completion does.
 * Headings, variable definitions, blank lines and a line that is already the whole draft are left
 * out, since taking one of those into the box would change nothing worth sending.
 */
export function suggestPaletteLines(palette: ChatPalette | null | undefined, draft: string): string[] {
  const needle = draft.trim().toLocaleLowerCase();
  if (!palette || Array.from(needle).length < 2) return [];
  const found: string[] = [];
  for (const { palette: line } of palette.paletteLines) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || palette.isPaletteIndex(line, 0)) continue;
    const lower = trimmed.toLocaleLowerCase();
    if (lower === needle || !lower.includes(needle) || found.includes(line)) continue;
    found.push(line);
    if (found.length >= MAX_PALETTE_SUGGESTIONS) break;
  }
  return found;
}

/** A palette line as it goes into the box, each written `\n` a real line break, as the palette panel does. */
export function paletteLineText(line: string): string {
  return line.replace(/\\n/g, '\n');
}
