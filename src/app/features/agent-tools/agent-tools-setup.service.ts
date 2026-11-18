import { inject, Injectable } from '@angular/core';
import { AgentEventLog } from '@axe/application/agent/agent-event-log.service';
import { AgentSeatLinkWatch } from '@axe/application/agent/agent-seat-link-watch.service';
import { AgentToolRunner } from '@axe/application/agent/agent-tool-runner.service';
import { AgentBuildTools } from '@axe/features/agent-tools/agent-build-tools.service';
import { AgentCardTools } from '@axe/features/agent-tools/agent-card-tools.service';
import { AgentChatTools } from '@axe/features/agent-tools/agent-chat-tools.service';
import { AgentGmTools } from '@axe/features/agent-tools/agent-gm-tools.service';
import { AgentHotbarTools } from '@axe/features/agent-tools/agent-hotbar-tools.service';
import { AgentPieceTools } from '@axe/features/agent-tools/agent-piece-tools.service';
import { AgentReadTools } from '@axe/features/agent-tools/agent-read-tools.service';
import { AgentTableTools } from '@axe/features/agent-tools/agent-table-tools.service';

/**
 * Makes the tools an AI can call runnable, and starts keeping what happens in the room, once a link
 * asks for them: the tools are services of their own, made only then, so that nothing of them is
 * loaded or kept before a seat links an AI.
 */
@Injectable({ providedIn: 'root' })
export class AgentToolsSetup {
  private readonly runner = inject(AgentToolRunner);
  private readonly events = inject(AgentEventLog);
  private readonly seatLinks = inject(AgentSeatLinkWatch);
  private readonly read = inject(AgentReadTools);
  private readonly chat = inject(AgentChatTools);
  private readonly pieces = inject(AgentPieceTools);
  private readonly gm = inject(AgentGmTools);
  private readonly table = inject(AgentTableTools);
  private readonly build = inject(AgentBuildTools);
  private readonly hotbar = inject(AgentHotbarTools);
  private readonly cards = inject(AgentCardTools);
  private done = false;

  /** Makes every tool runnable, once, and keeps what happens from now. */
  ensure(): void {
    this.events.start();
    this.seatLinks.start();
    if (this.done) return;
    this.done = true;
    this.runner.provide(this.read.handlers);
    this.runner.provide(this.chat.handlers);
    this.runner.provide(this.pieces.handlers);
    this.runner.provide(this.gm.handlers);
    this.runner.provide(this.table.handlers);
    this.runner.provide(this.build.handlers);
    this.runner.provide(this.hotbar.handlers);
    this.runner.provide(this.cards.handlers);
  }

  /** Stops keeping what happens. */
  release(): void {
    this.events.stop();
    this.seatLinks.stop();
  }
}
