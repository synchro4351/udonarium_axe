import { effect, EffectRef, inject, Injectable, Injector } from '@angular/core';
import { AgentToolRunner } from '@axe/application/agent/agent-tool-runner.service';
import { ActiveChatTabService } from '@axe/application/chat/active-chat-tab.service';
import { callWritingAMessage } from '@axe/core/event/domain-events';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';

/** How often the typing mark is sent while the AI thinks, inside the two seconds it lasts. */
export const THINKING_SIGNAL_MS = 1_500;

/**
 * Shows the table that the AI linked to this seat is thinking or using a tool, with the same mark
 * as someone typing in the chat tab in use: it is sent over and over while the AI is busy, and goes
 * by itself once the AI waits for the room or stops.
 */
@Injectable({ providedIn: 'root' })
export class AgentThinkingSignal {
  private readonly runner = inject(AgentToolRunner);
  private readonly activeTab = inject(ActiveChatTabService);
  private readonly injector = inject(Injector);
  private watch: EffectRef | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.watch) return;
    this.watch = effect(
      () => {
        const busy = this.runner.activity() === 'thinking' || this.runner.activity() === 'working';
        if (busy) this.beginSignal();
        else this.endSignal();
      },
      { injector: this.injector }
    );
  }

  stop(): void {
    this.watch?.destroy();
    this.watch = null;
    this.endSignal();
    this.runner.rest();
  }

  /** Sends the mark once, in the chat tab in use, as this seat. */
  signal(): void {
    const tab = this.activeTab.current();
    if (tab) callWritingAMessage(tab.identifier, null, PeerCursor.myCursor?.identifier ?? null);
  }

  private beginSignal(): void {
    if (this.timer) return;
    this.signal();
    this.timer = setInterval(() => this.signal(), THINKING_SIGNAL_MS);
  }

  private endSignal(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
