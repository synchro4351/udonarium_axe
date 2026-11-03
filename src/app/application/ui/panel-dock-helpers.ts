/** The sides of the screen a panel can be docked against. */
export type DockEdge = 'left' | 'right';

/** A panel's place on the screen, in pixels. */
export interface DockBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How close to the side of the screen the pointer has to come for a panel to dock there. */
export const DOCK_EDGE_REACH_PX = 24;

/** How many panels one side holds one above the other; any more join one of them as a tab. */
export const DOCK_SLOTS_PER_EDGE = 2;

/** The side the pointer is pressed against, or null away from both. */
export function dockEdgeAt(x: number, viewportWidth: number, reach = DOCK_EDGE_REACH_PX): DockEdge | null {
  if (x <= reach) return 'left';
  if (x >= viewportWidth - reach) return 'right';
  return null;
}

/**
 * Where each of the panels docked on one side goes, top first.
 *
 * Each keeps its own width, pulled in to the screen; the height is shared out between them
 * evenly, so one reaches from top to bottom and two split it in half.
 */
export function dockBoxes(
  edge: DockEdge,
  widths: readonly number[],
  viewport: { width: number; height: number }
): DockBox[] {
  if (widths.length === 0) return [];
  const height = Math.floor(viewport.height / widths.length);
  return widths.map((wanted, at) => {
    const width = Math.max(0, Math.min(wanted, viewport.width));
    const top = at * height;
    // The last one takes whatever pixel the even split left over.
    const ownHeight = at === widths.length - 1 ? viewport.height - top : height;
    return { left: edge === 'left' ? 0 : viewport.width - width, top, width, height: ownHeight };
  });
}

/**
 * What letting go of a panel on a side does, given the panels already there top first: take a
 * place of its own at `index`, or join the docked panel at `index` as a tab once the side is
 * full. The half of the screen the pointer is in picks which.
 */
export function dockPlacement(
  docked: number,
  pointerY: number,
  viewportHeight: number
): { kind: 'slot'; index: number } | { kind: 'tab'; index: number } {
  const upper = pointerY < viewportHeight / 2;
  if (docked >= DOCK_SLOTS_PER_EDGE) return { kind: 'tab', index: upper ? 0 : docked - 1 };
  if (docked === 0) return { kind: 'slot', index: 0 };
  return { kind: 'slot', index: upper ? 0 : docked };
}

/**
 * The box a panel let go of here would fill, shown before it is let go of: the place it would
 * take, or the docked panel it would join.
 */
export function dockPreviewBox(
  edge: DockEdge,
  dockedWidths: readonly number[],
  heldWidth: number,
  pointerY: number,
  viewport: { width: number; height: number }
): DockBox {
  const placement = dockPlacement(dockedWidths.length, pointerY, viewport.height);
  if (placement.kind === 'tab') return dockBoxes(edge, dockedWidths, viewport)[placement.index];
  const widths = [...dockedWidths];
  widths.splice(placement.index, 0, heldWidth);
  return dockBoxes(edge, widths, viewport)[placement.index];
}
