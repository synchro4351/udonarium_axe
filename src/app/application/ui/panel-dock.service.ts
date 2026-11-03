import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { PanelFrame } from '@axe/application/ui/panel.service';
import {
  DockBox,
  dockBoxes,
  DockEdge,
  dockEdgeAt,
  dockPlacement,
  dockPreviewBox,
} from '@axe/application/ui/panel-dock-helpers';

/** A frame, as far as docking is concerned: what it holds, and how to put it in its place. */
export interface PanelDockFrame extends PanelFrame {
  /** Puts the frame in a docked place, or lets it go back to the size it had before, given null. */
  applyDock: (box: DockBox | null) => void;
}

/**
 * The panels docked against the sides of the screen, and where a panel being dragged would go.
 *
 * Each side holds up to two panels, one above the other, filling the height of the screen
 * between them; a panel let go of on a full side joins the nearer of the two as a tab. Only
 * panels in the main window dock: one in a window of its own is wearing the operating system's
 * frame.
 */
@Injectable({ providedIn: 'root' })
export class PanelDockService {
  private readonly docked: Record<DockEdge, PanelDockFrame[]> = { left: [], right: [] };

  /** The box a panel let go of now would fill, shown while it is being dragged. */
  readonly preview = signal<DockBox | null>(null);
  private pending: { edge: DockEdge; y: number } | null = null;

  constructor() {
    const relayout = () => this.relayout();
    window.addEventListener('resize', relayout);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', relayout));
  }

  /** The side the frame is docked on, or null for a frame standing free. */
  edgeOf(frame: PanelFrame): DockEdge | null {
    if (this.docked.left.some((one) => one.frameKey === frame.frameKey)) return 'left';
    if (this.docked.right.some((one) => one.frameKey === frame.frameKey)) return 'right';
    return null;
  }

  /**
   * Takes a frame off its side as it is picked up, so it stands free again at the size it had
   * before, and the panels left on the side close up.
   */
  undock(frame: PanelDockFrame): void {
    const edge = this.edgeOf(frame);
    if (!edge) return;
    this.docked[edge] = this.docked[edge].filter((one) => one.frameKey !== frame.frameKey);
    frame.applyDock(null);
    this.relayout(edge);
  }

  /** Forgets a frame that has been taken down, and closes up the side it was on. */
  forget(frame: PanelFrame): void {
    const edge = this.edgeOf(frame);
    if (!edge) return;
    this.docked[edge] = this.docked[edge].filter((one) => one.frameKey !== frame.frameKey);
    this.relayout(edge);
  }

  /** Follows the pointer while a frame is dragged: near a side it shows where the frame would go. */
  hover(frame: PanelDockFrame, x: number, y: number): void {
    const edge = this.dockable(frame) ? dockEdgeAt(x, window.innerWidth) : null;
    if (!edge) {
      this.clearHover();
      return;
    }
    this.pending = { edge, y };
    this.preview.set(
      dockPreviewBox(edge, this.widthsOn(edge), frame.frameSize().width, y, {
        width: window.innerWidth,
        height: window.innerHeight,
      })
    );
  }

  /** Drops whatever the pointer was showing, as when the drag goes somewhere else instead. */
  clearHover(): void {
    this.pending = null;
    this.preview.set(null);
  }

  /**
   * Docks the frame let go of where the pointer last showed, and says whether it did. A frame let
   * go of on a full side is folded into the docked frame nearer the pointer, and goes.
   */
  drop(frame: PanelDockFrame): boolean {
    const pending = this.pending;
    this.clearHover();
    if (!pending || !this.dockable(frame)) return false;
    const { edge, y } = pending;
    const others = this.docked[edge].filter((one) => one.frameKey !== frame.frameKey);
    const placement = dockPlacement(others.length, y, window.innerHeight);
    if (placement.kind === 'tab') {
      const host = others[placement.index];
      for (const handoff of frame.handOverAll()) host.takeIn(handoff);
      frame.dismissFrame();
      return true;
    }
    others.splice(placement.index, 0, frame);
    this.docked[edge] = others;
    this.relayout(edge);
    return true;
  }

  /** Puts the docked frames back in their places, as when the screen changes size. */
  relayout(only?: DockEdge): void {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    for (const edge of only ? [only] : (['left', 'right'] as const)) {
      const frames = this.docked[edge];
      const boxes = dockBoxes(edge, this.widthsOn(edge), viewport);
      frames.forEach((frame, at) => frame.applyDock(boxes[at]));
    }
  }

  private widthsOn(edge: DockEdge): number[] {
    return this.docked[edge].map((frame) => frame.frameSize().width);
  }

  private dockable(frame: PanelFrame): boolean {
    return frame.frameDocument() === document;
  }
}
