import {
  clockTickMs,
  formatClock,
  formatDuration,
  formatElapsed,
  formatRemaining,
  usesClock,
  withClock,
} from '@axe/domain/media/cut-in-clock-text';

describe('a cut-in text that tells the time', () => {
  const evening = new Date(2026, 9, 21, 21, 5, 30).getTime();

  it('knows which words change as the clock runs', () => {
    expect(usesClock('{time} から再開')).toBe(true);
    expect(usesClock('あと{remaining}')).toBe(true);
    expect(usesClock('{character}、参戦！')).toBe(false);
  });

  it('writes the time of day as hours and minutes', () => {
    expect(formatClock(evening)).toBe('21:05');
    expect(formatClock(new Date(2026, 9, 21, 7, 0, 59).getTime())).toBe('07:00');
  });

  it('writes the time left in minutes and seconds, rounded up, with hours from an hour', () => {
    expect(formatRemaining(10 * 60 * 1000)).toBe('10:00');
    expect(formatRemaining(9 * 60 * 1000 + 59_001)).toBe('10:00');
    expect(formatRemaining(59_999)).toBe('1:00');
    expect(formatRemaining(1)).toBe('0:01');
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5000)).toBe('0:00');
    expect(formatRemaining(60 * 60 * 1000)).toBe('1:00:00');
  });

  it('puts the time in for {time} and {remaining}, and keeps the doubled tokens as written', () => {
    const endsAt = evening + 5 * 60 * 1000;
    const clock = { nowMs: evening, endsAtMs: endsAt, startedAtMs: null };
    expect(withClock('休憩 {time} / あと{remaining}', clock)).toBe('休憩 21:05 / あと5:00');
    expect(withClock('あと{remaining}', { ...clock, endsAtMs: null })).toBe('あと--:--');
    expect(withClock('{{time}} と {{remaining}} と {{elapsed:3}} と書く', clock)).toBe(
      '{time} と {remaining} と {elapsed:3} と書く'
    );
    expect(withClock('ふつうの文', clock)).toBe('ふつうの文');
  });

  it('counts the whole seconds since the cut-in came on, from 0 while it is not played', () => {
    const clock = { nowMs: evening, endsAtMs: null, startedAtMs: evening - 7_900 };
    expect(usesClock('{elapsed}秒')).toBe(true);
    expect(usesClock('{elapsed:3}')).toBe(true);
    expect(withClock('{elapsed}秒経過', clock)).toBe('7秒経過');
    expect(withClock('{elapsed}', { ...clock, startedAtMs: null })).toBe('0');
    expect(formatElapsed(-500)).toBe('0');
  });

  it('pads a token to the digits written after its colon', () => {
    const clock = { nowMs: evening, endsAtMs: evening + 9 * 60 * 1000 + 59_000, startedAtMs: evening - 7_000 };
    expect(withClock('[{elapsed:3}]', clock)).toBe('[007]');
    expect(withClock('{remaining:2}', clock)).toBe('09:59');
    expect(formatRemaining(3_725_000, 2)).toBe('01:02:05');
    expect(withClock('{elapsed:3}', { ...clock, startedAtMs: evening - 12_345_000 })).toBe('12345');
    expect(withClock('{time:4}', clock)).toBe('21:05');
  });
  it('writes a time to a pattern of hours, minutes and seconds, the first unit holding the whole', () => {
    expect(formatDuration(125_000, 'mm:ss')).toBe('02:05');
    expect(formatDuration(125_000, 'sss')).toBe('125');
    expect(formatDuration(7_000, 'sss')).toBe('007');
    expect(formatDuration(3_725_000, 'h:mm:ss')).toBe('1:02:05');
    expect(formatDuration(3_725_000, 'mm:ss')).toBe('62:05');
    expect(formatDuration(7_256, 'ss.00')).toBe('07.25');
    expect(formatDuration(7_251, 'ss.00', true)).toBe('07.26');
    expect(formatDuration(65_400, 'm:ss.0')).toBe('1:05.4');
    expect(formatDuration(1_000, 'ss:mm')).toBeNull();
    expect(formatDuration(1_000, 'mm.0')).toBeNull();
  });

  it('reads a pattern after the colon of any token, counting down up and up down', () => {
    const clock = { nowMs: evening, endsAtMs: evening + 65_001, startedAtMs: evening - 7_256 };
    expect(withClock('{remaining:mm:ss}', clock)).toBe('01:06');
    expect(withClock('{elapsed:sss}', clock)).toBe('007');
    expect(withClock('{elapsed:ss.00}', clock)).toBe('07.25');
    expect(withClock('{time:hh:mm:ss}', clock)).toBe('21:05:30');
    expect(withClock('{elapsed:zz}', clock)).toBe('{elapsed:zz}');
  });

  it('moves the clock on faster only for a time with decimals', () => {
    expect(clockTickMs('{elapsed:sss}')).toBe(1000);
    expect(clockTickMs('{elapsed:ss.0}')).toBe(100);
    expect(clockTickMs('{remaining} {elapsed:ss.00}')).toBe(50);
  });
});
