/** What a text layer writes to be given the time of day on the watcher's own clock. */
export const CLOCK_TOKEN = '{time}';

/** What a text layer writes to be given how long is left before the cut-in closes. */
export const REMAINING_TOKEN = '{remaining}';

/** What a text layer writes to be given how many seconds the cut-in has been on. */
export const ELAPSED_TOKEN = '{elapsed}';

/**
 * A clock token, with an optional width after a colon: `{elapsed:3}` shows at least three digits,
 * `{remaining:2}` at least two in front of the colon. Doubled braces write the token as it is.
 */
const TOKEN_PATTERN = /\{\{(time|remaining|elapsed)(?::(\d))?\}\}|\{(time|remaining|elapsed)(?::(\d))?\}/g;

/** Whether a text layer's words change as the clock runs. */
export function usesClock(text: string): boolean {
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.test(text);
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
 * the seconds are rounded up, so `0:00` shows only once the time is out. `width` pads what comes
 * before the first colon, as `09:59` for 2.
 */
export function formatRemaining(remainingMs: number, width = 1): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${String(hours).padStart(width, '0')}:${twoDigits(minutes)}:${twoDigits(seconds)}`
    : `${String(minutes).padStart(width, '0')}:${twoDigits(seconds)}`;
}

/** The whole seconds the cut-in has been on, at least `width` digits long, as `007` for 3. */
export function formatElapsed(elapsedMs: number, width = 1): string {
  return String(Math.max(0, Math.floor(elapsedMs / 1000))).padStart(width, '0');
}

/** What `{remaining}` shows for a cut-in that stays until it is stopped. */
export const NO_END_REMAINING = '--:--';

/** The moments a text layer's clock tokens are read against, on the watcher's own clock. */
export interface CutInClock {
  readonly nowMs: number;
  /** When the cut-in closes, or null where it stays until it is stopped. */
  readonly endsAtMs: number | null;
  /** When the cut-in came on, or null where it is not playing, which counts from 0. */
  readonly startedAtMs: number | null;
}

/**
 * A text layer's words with the time of day put in for `{time}`, the time left before the cut-in
 * closes for `{remaining}` (or `--:--` where it has no end), and the seconds it has been on for
 * `{elapsed}`, each padded to a width written after a colon; doubled braces stay as the token.
 */
export function withClock(text: string, clock: CutInClock): string {
  if (!usesClock(text)) return text;
  return text.replace(TOKEN_PATTERN, (found, escaped, escapedWidth, name, width) => {
    if (escaped) return found.slice(1, -1);
    const digits = Number(width ?? 1);
    if (name === 'time') return formatClock(clock.nowMs);
    if (name === 'remaining') {
      return clock.endsAtMs === null ? NO_END_REMAINING : formatRemaining(clock.endsAtMs - clock.nowMs, digits);
    }
    return formatElapsed(clock.startedAtMs === null ? 0 : clock.nowMs - clock.startedAtMs, digits);
  });
}
