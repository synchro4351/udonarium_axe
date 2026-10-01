export interface SpotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SpotSize {
  width: number;
  height: number;
}

const MARGIN = 8;

/** Where the chat window first opens on a screen that is not compact, before the reader moves it. */
export const FIRST_CHAT_WINDOW = { left: 80, width: 660, height: 460, bottomGap: 20 } as const;

/**
 * Where a bar first brought out along the bottom of the screen starts, from the left edge it
 * would otherwise be given.
 *
 * Left alone where it already clears the place the chat window first opens. Otherwise it moves
 * right until it does, or as far as the screen lets it, so the line typed into is not under it.
 */
export function leftClearOfFirstChat(left: number, width: number, viewportWidth: number): number {
  const clear = FIRST_CHAT_WINDOW.left + FIRST_CHAT_WINDOW.width + MARGIN * 2;
  if (left >= clear) return left;
  return clamp(clear, viewportWidth, width);
}

/** Keeps a new bar above the first chat window when there is no room beside it. */
export function topClearOfFirstChat(left: number, top: number, height: number, viewportHeight: number): number {
  if (left >= FIRST_CHAT_WINDOW.left + FIRST_CHAT_WINDOW.width + MARGIN) return top;
  const chatTop = Math.max(10, viewportHeight - FIRST_CHAT_WINDOW.height - FIRST_CHAT_WINDOW.bottomGap);
  return Math.max(MARGIN, Math.min(top, chatTop - height - MARGIN));
}

/**
 * Where a panel opened from a control belongs: centred on it and just clear of it, above where
 * there is room and below where there is not, never off the edge of the screen.
 */
export function spotBeside(anchor: SpotRect, size: SpotSize, viewport: SpotSize): { left: number; top: number } {
  const above = anchor.top - size.height - MARGIN;
  const below = anchor.bottom + MARGIN;
  const top = above >= MARGIN ? above : below;
  const left = anchor.left + (anchor.right - anchor.left) / 2 - size.width / 2;

  return {
    left: clamp(left, viewport.width, size.width),
    top: clamp(top, viewport.height, size.height),
  };
}

function clamp(value: number, room: number, length: number): number {
  return Math.round(Math.max(MARGIN, Math.min(value, Math.max(MARGIN, room - length - MARGIN))));
}
