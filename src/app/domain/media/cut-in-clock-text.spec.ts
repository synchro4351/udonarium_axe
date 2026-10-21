import { formatClock, formatRemaining, usesClock, withClock } from '@axe/domain/media/cut-in-clock-text';

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
    expect(withClock('休憩 {time} / あと{remaining}', evening, endsAt)).toBe('休憩 21:05 / あと5:00');
    expect(withClock('あと{remaining}', evening, null)).toBe('あと--:--');
    expect(withClock('{{time}} と {{remaining}} と書く', evening, endsAt)).toBe('{time} と {remaining} と書く');
    expect(withClock('ふつうの文', evening, endsAt)).toBe('ふつうの文');
  });
});
