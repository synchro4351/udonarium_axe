/** What a text layer writes to be given the time of day on the watcher's own clock. */
export const CLOCK_TOKEN = '{time}';

/** What a text layer writes to be given how long is left before the cut-in closes. */
export const REMAINING_TOKEN = '{remaining}';

/** Whether a text layer's words change as the clock runs. */
export function usesClock(text: string): boolean {
  return text.includes(CLOCK_TOKEN) || text.includes(REMAINING_TOKEN);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** The time of day as hours and minutes, as `21:05`. */
export function formatClock(nowMs: number): string {
  const now = new Date(nowMs);
  return `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
}

/**
 * A time left as minutes and seconds, as `9:59`, with hours in front from an hour up, as `1:00:00`;
 * the seconds are rounded up, so `0:00` shows only once the time is out.
 */
export function formatRemaining(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${twoDigits(seconds)}` : `${minutes}:${twoDigits(seconds)}`;
}

/** What `{remaining}` shows for a cut-in that stays until it is stopped. */
export const NO_END_REMAINING = '--:--';

/**
 * A text layer's words with the time of day put in for `{time}` and the time left before the cut-in
 * closes for `{remaining}`, or `--:--` where it has no end; `{{time}}` and `{{remaining}}` stay as
 * the tokens, for words that mean them.
 */
export function withClock(text: string, nowMs: number, endsAtMs: number | null): string {
  if (!usesClock(text)) return text;
  return text.replace(/\{\{time\}\}|\{time\}|\{\{remaining\}\}|\{remaining\}/g, (token) => {
    if (token === CLOCK_TOKEN) return formatClock(nowMs);
    if (token === REMAINING_TOKEN) return endsAtMs === null ? NO_END_REMAINING : formatRemaining(endsAtMs - nowMs);
    return token.slice(1, -1);
  });
}
