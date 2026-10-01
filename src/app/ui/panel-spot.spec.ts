import { FIRST_CHAT_WINDOW, leftClearOfFirstChat, spotBeside, topClearOfFirstChat } from '@axe/ui/panel-spot';

describe('placing a bar first brought out along the bottom', () => {
  const chatRight = FIRST_CHAT_WINDOW.left + FIRST_CHAT_WINDOW.width;

  it('moves a centred bar right of where the chat window first opens', () => {
    const left = leftClearOfFirstChat((1440 - 560) / 2, 560, 1440);

    expect(left).toBeGreaterThan(chatRight);
    expect(left + 560).toBeLessThanOrEqual(1440 - 8);
  });

  it('leaves a bar that already clears the chat window where it is', () => {
    expect(leftClearOfFirstChat(900, 300, 1920)).toBe(900);
  });

  it('goes only as far as the right edge on a screen too narrow for both', () => {
    expect(leftClearOfFirstChat((1024 - 560) / 2, 560, 1024)).toBe(1024 - 560 - 8);
  });
});

describe('placing a panel beside the control it was opened from', () => {
  const size = { width: 380, height: 520 };
  const viewport = { width: 1280, height: 800 };

  it('puts it above the control, centred on it', () => {
    const spot = spotBeside({ left: 600, top: 700, right: 644, bottom: 744 }, size, viewport);

    expect(spot).toEqual({ left: 432, top: 172 });
  });

  it('drops it below where there is no room above', () => {
    const spot = spotBeside({ left: 600, top: 40, right: 644, bottom: 84 }, size, viewport);

    expect(spot.top).toBe(92);
  });

  it('keeps it on screen at either edge', () => {
    const left = spotBeside({ left: 0, top: 700, right: 44, bottom: 744 }, size, viewport);
    const right = spotBeside({ left: 1236, top: 700, right: 1280, bottom: 744 }, size, viewport);

    expect(left.left).toBe(8);
    expect(right.left).toBe(892);
  });

  it('settles at the margin on a screen smaller than the panel', () => {
    const spot = spotBeside({ left: 10, top: 10, right: 54, bottom: 54 }, size, { width: 300, height: 300 });

    expect(spot).toEqual({ left: 8, top: 8 });
  });
});

describe('placing a new bar when it cannot fit beside the first chat window', () => {
  it('keeps the bar above chat on a medium screen rather than covering the input', () => {
    const top = topClearOfFirstChat(413, 670, 82, 768);
    expect(top + 82).toBeLessThan(768 - FIRST_CHAT_WINDOW.height - FIRST_CHAT_WINDOW.bottomGap);
  });

  it('leaves the bottom position alone when the bar fits beside chat', () => {
    expect(topClearOfFirstChat(756, 802, 82, 900)).toBe(802);
  });

  it('keeps the top reachable when there is little space above chat', () => {
    expect(topClearOfFirstChat(413, 400, 232, 600)).toBe(8);
  });
});
