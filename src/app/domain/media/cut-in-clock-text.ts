/** What a text layer writes to be given the time of day on the watcher's own clock. */
export const CLOCK_TOKEN = '{time}';

/** What a text layer writes to be given how long is left before the cut-in closes. */
export const REMAINING_TOKEN = '{remaining}';

/** What a text layer writes to be given how many seconds the cut-in has been on. */
export const ELAPSED_TOKEN = '{elapsed}';

/**
 * A clock token, with an optional format after a colon: a width, as `{elapsed:3}`, or a pattern of
 * hours, minutes and seconds, as `{remaining:mm:ss}`, `{elapsed:sss}` or `{elapsed:ss.00}` (see
 * `formatDuration`). Doubled braces write the token as it is.
 */
const TOKEN_PATTERN =
  /\{\{(time|remaining|elapsed)(?::([hms:.0-9]{1,16}))?\}\}|\{(time|remaining|elapsed)(?::([hms:.0-9]{1,16}))?\}/g;

/** A format of hours, minutes and seconds: letters for each unit, `:` between, `.0`s for decimals. */
const DURATION_FORMAT = /^(h+|m+|s+)(?::(m+|s+))?(?::(s+))?(?:\.(0+))?$/;

/**
 * A length of time written to a format: each letter run is a unit at least as many digits wide,
 * the first unit shows the whole of the time in it (`sss` for 125 seconds is `125`), the units
 * after it wrap, and `.0`s give the seconds that many decimals. Rounded up where `up`, as a
 * countdown is, and down otherwise. Null for a format that is not one.
 */
export function formatDuration(ms: number, format: string, up = false): string | null {
  const match = DURATION_FORMAT.exec(format);
  if (!match) return null;
  const units = [match[1], match[2], match[3]].filter((unit): unit is string => !!unit);
  const order = 'hms';
  for (let at = 1; at < units.length; at++) {
    if (order.indexOf(units[at][0]) <= order.indexOf(units[at - 1][0])) return null;
  }
  const decimals = match[4]?.length ?? 0;
  if (decimals > 0 && units.at(-1)![0] !== 's') return null;
  const step = units.at(-1)![0] === 'h' ? 3_600_000 : units.at(-1)![0] === 'm' ? 60_000 : 1000 / 10 ** decimals;
  const steps = Math.max(0, ms) / step;
  const total = (up ? Math.ceil(steps - 1e-9) : Math.floor(steps + 1e-9)) * step;
  const sizes: Record<string, number> = { h: 3_600_000, m: 60_000, s: 1000 };
  let rest = total;
  return units
    .map((unit, at) => {
      const size = sizes[unit[0]];
      const whole = at === units.length - 1 ? rest / size : Math.floor(rest / size);
      rest -= Math.floor(whole) * size;
      const last = at === units.length - 1;
      const text = last && decimals > 0 ? whole.toFixed(decimals) : String(Math.floor(whole));
      const [integer, fraction] = text.split('.');
      return integer.padStart(unit.length, '0') + (fraction ? `.${fraction}` : '');
    })
    .join(':');
}

/** How often a text's clock tokens need the clock moved on, in ms: each second, or faster for decimals. */
export function clockTickMs(text: string): number {
  let tick = 1000;
  TOKEN_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const decimals = /\.(0+)$/.exec(match[4] ?? '')?.[1].length ?? 0;
    if (decimals > 0) tick = Math.min(tick, decimals === 1 ? 100 : 50);
  }
  return tick;
}

/** Whether a text layer's words change as the clock runs. */
export function usesClock(text: string): boolean {
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.test(text);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** The time of day as hours and minutes, as `21:05`. */
export function formatClock(nowMs: number, format?: string): string {
  const now = new Date(nowMs);
  if (format && DURATION_FORMAT.test(format) && format.startsWith('h')) {
    const sinceMidnight = ((now.getHours() * 60 + now.getMinutes()) * 60 + now.getSeconds()) * 1000;
    return (
      formatDuration(sinceMidnight + now.getMilliseconds(), format) ??
      `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`
    );
  }
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
  return text.replace(TOKEN_PATTERN, (found, escaped, escapedFormat, name, format: string | undefined) => {
    if (escaped) return found.slice(1, -1);
    const width = format && /^\d$/.test(format) ? Number(format) : 1;
    const pattern = format && !/^\d$/.test(format) ? format : null;
    if (name === 'time') return formatClock(clock.nowMs, pattern ?? undefined);
    if (name === 'remaining') {
      if (clock.endsAtMs === null) return NO_END_REMAINING;
      const left = clock.endsAtMs - clock.nowMs;
      return (pattern && formatDuration(left, pattern, true)) || formatRemaining(left, width);
    }
    const since = clock.startedAtMs === null ? 0 : clock.nowMs - clock.startedAtMs;
    return (pattern && formatDuration(since, pattern)) || formatElapsed(since, width);
  });
}
