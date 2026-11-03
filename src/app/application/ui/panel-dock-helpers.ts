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

/** How far into a docked panel, from its top or bottom, a panel let go of splits it rather than joining it. */
export const DOCK_SPLIT_REACH = 1 / 3;

/**
 * What letting go of a panel on a side does, given how many panels are there already, top first:
 * take a place of its own at `index`, or join the docked panel at `index` as a tab.
 *
 * Over the top or bottom third of a docked panel it splits the height with it, above or below;
 * over the middle it joins it as a tab. A side holding two already only takes tabs.
 */
export function dockPlacement(
  docked: number,
  pointerY: number,
  viewportHeight: number
): { kind: 'slot'; index: number } | { kind: 'tab'; index: number } {
  if (docked === 0) return { kind: 'slot', index: 0 };
  const share = viewportHeight / docked;
  const index = Math.min(docked - 1, Math.max(0, Math.floor(pointerY / share)));
  if (docked >= DOCK_SLOTS_PER_EDGE) return { kind: 'tab', index };
  const into = (pointerY - index * share) / share;
  if (into < DOCK_SPLIT_REACH) return { kind: 'slot', index };
  if (into > 1 - DOCK_SPLIT_REACH) return { kind: 'slot', index: index + 1 };
  return { kind: 'tab', index };
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
