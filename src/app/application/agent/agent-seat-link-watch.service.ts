import { inject, Injectable } from '@angular/core';
import { AgentEventLog } from '@axe/application/agent/agent-event-log.service';
import { getPeerContexts } from '@axe/core/network/peer-context-source';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

/** How often the seats' links are looked at. */
export const LINK_LOOK_MS = 5_000;
/** How long a seat may be gone before it counts as down, past what reconnecting by itself covers. */
export const DOWN_AFTER_MS = 60_000;
/** The stretch of time drops are counted over. */
export const DROP_WINDOW_MS = 10 * 60_000;
/** How many drops within that stretch make a seat's link unstable. */
export const UNSTABLE_DROPS = 4;

/** What is kept of one seat's link. */
interface SeatLink {
  name: string;
  /** When it went, while it is gone. */
  goneAt: number | null;
  /** Whether its going was told as being down. */
  toldDown: boolean;
  /** When it went, each time, within the stretch counted. */
  drops: number[];
  /** When its link was last told unstable, so it is told once a stretch. */
  toldUnstableAt: number;
  /** The longest it was gone within the stretch, in milliseconds. */
  longest: number;
}

/**
 * Watches the other seats' links for an AI and tells it only of trouble someone has to
 * deal with: a seat gone for over a minute, past what reconnecting by itself covers, and when it comes
 * back, or a seat whose link keeps dropping, with how often and how long. A drop the link gets over by
 * itself in seconds is not told, so the AI's turns are not filled with them.
 */
@Injectable({ providedIn: 'root' })
export class AgentSeatLinkWatch {
  private readonly events = inject(AgentEventLog);
  private readonly links = new Map<string, SeatLink>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Starts watching, from the seats linked now. */
  start(): void {
    if (this.timer !== null) return;
    this.links.clear();
    for (const [userId, name] of this.linkedSeats()) this.links.set(userId, this.fresh(name));
    this.timer = setInterval(() => this.look(), LINK_LOOK_MS);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.links.clear();
  }

  /** Looks at the links once, as the timer does; public for the specs. */
  look(now: number = Date.now()): void {
    const linked = this.linkedSeats();
    for (const [userId, name] of linked) {
      const link = this.links.get(userId);
      if (!link) {
        this.links.set(userId, this.fresh(name));
        continue;
      }
      link.name = name;
      if (link.goneAt === null) continue;
      const gone = now - link.goneAt;
      link.longest = Math.max(link.longest, gone);
      if (link.toldDown)
        this.events.tell({ kind: 'seat_link_back', seat: name, downForSeconds: Math.round(gone / 1000) });
      link.goneAt = null;
      link.toldDown = false;
    }
    for (const [userId, link] of this.links) {
      if (linked.has(userId)) {
        this.checkUnstable(link, now);
        continue;
      }
      if (link.goneAt === null) {
        link.goneAt = now;
        link.drops.push(now);
      } else if (!link.toldDown && now - link.goneAt >= DOWN_AFTER_MS) {
        link.toldDown = true;
        this.events.tell({
          kind: 'seat_link_trouble',
          seat: link.name,
          trouble: 'down',
          downForSeconds: Math.round((now - link.goneAt) / 1000),
          dropsLast10Minutes: this.dropsWithin(link, now),
        });
      }
    }
  }

  private checkUnstable(link: SeatLink, now: number): void {
    const drops = this.dropsWithin(link, now);
    if (drops < UNSTABLE_DROPS || now - link.toldUnstableAt < DROP_WINDOW_MS) return;
    link.toldUnstableAt = now;
    this.events.tell({
      kind: 'seat_link_trouble',
      seat: link.name,
      trouble: 'unstable',
      dropsLast10Minutes: drops,
      longestDownSeconds: Math.round(link.longest / 1000),
    });
  }

  private dropsWithin(link: SeatLink, now: number): number {
    link.drops = link.drops.filter((at) => now - at < DROP_WINDOW_MS);
    if (link.drops.length === 0) link.longest = 0;
    return link.drops.length;
  }

  /** The other seats linked now, by user, with the names they go by. */
  private linkedSeats(): Map<string, string> {
    const mine = PeerCursor.myCursor?.userId ?? '';
    const seats = new Map<string, string>();
    for (const context of getPeerContexts()) {
      const userId = context.userId;
      if (!userId || userId === mine) continue;
      seats.set(userId, PeerCursor.findByUserId(userId)?.name ?? userId);
    }
    return seats;
  }

  private fresh(name: string): SeatLink {
    return { name, goneAt: null, toldDown: false, drops: [], toldUnstableAt: -Infinity, longest: 0 };
  }
}
