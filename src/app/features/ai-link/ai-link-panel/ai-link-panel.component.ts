import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AgentPersonaService } from '@axe/application/agent/agent-persona.service';
import { AgentToolRunner } from '@axe/application/agent/agent-tool-runner.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ImageService } from '@axe/application/storage/image.service';
import { ModalService } from '@axe/application/ui/modal.service';
import { AGENT_BRIDGE_PORT, AGENT_TRUSTED_ORIGINS, type AgentScope } from '@axe/core/agent/agent-protocol';
import { agentToolOf } from '@axe/core/agent/agent-tools';
import { canRoleEdit } from '@axe/domain/peer/peer-role';
import { AiLinkService } from '@axe/features/ai-link/ai-link.service';
import { FileSelecterComponent } from '@axe/ui/components/file-selecter/file-selecter.component';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

/** Where the bridge is downloaded from. */
/**
 * Where tyoitashi's build of the bridge is put next to the page (tyoitashi). Its tools differ from the
 * official ones, so the official bridge refuses this Axe, and the bridge is taken from the site itself.
 */
export const TYOITASHI_BRIDGE_PATH = 'assets/axe-mcp/axe-mcp.mjs';

/** The address of tyoitashi's bridge on the site the page is served from. */
/** The steps for running the AI on a Claude Pro or Max plan through Claude Code (tyoitashi), as the fork shows them. */
export const SUBSCRIPTION_GUIDE_URL =
  'https://github.com/synchro4351/udonarium_axe/blob/codex/synwork-integration/docs/TYOITASHI_AI_GM_SUBSCRIPTION.md';

export function aiLinkBridgeUrl(): string {
  return new URL(TYOITASHI_BRIDGE_PATH, document.baseURI).href;
}

/** What the panel says of where the link stands, by the i18n key under feature.aiLink.state. */
export type AiLinkStateKey = 'idle' | 'connecting' | 'connected' | 'unreachable' | 'lost' | 'busy' | 'protocol';

/**
 * The panel a seat links an AI from: whether it is linked, what it lets the AI do, what the AI has
 * done, and how to set up the bridge the AI is started with, written for this page, and the port it
 * waits on where that is not the usual one.
 */
@Component({
  selector: 'ai-link-panel',
  templateUrl: './ai-link-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafePipe, TranslocoModule],
  host: { class: 'block h-full' },
})
export class AiLinkPanelComponent {
  protected readonly link = inject(AiLinkService);
  protected readonly runner = inject(AgentToolRunner);
  private readonly permission = inject(RolePermissionService);
  protected readonly persona = inject(AgentPersonaService);
  private readonly modal = inject(ModalService);
  private readonly images = inject(ImageService);
  /** Bumped as the AI's name or face changes, for what shows them to read again. */
  protected readonly personaVersion = signal(0);

  /** The picture of the AI's face, empty while none is chosen. */
  protected personaFaceUrl(): string {
    this.personaVersion();
    const identifier = this.persona.imageIdentifier();
    return identifier ? this.images.getSkeletonOr(identifier).url : '';
  }

  protected setPersonaName(event: Event): void {
    this.persona.setName((event.target as HTMLInputElement).value);
    this.personaVersion.update((v) => v + 1);
  }

  /** Picks a picture from the room's for the AI's face. */
  protected pickPersonaFace(): void {
    void this.modal.open<string>(FileSelecterComponent).then((identifier) => {
      if (!identifier) return;
      this.persona.setImage(identifier);
      this.personaVersion.update((v) => v + 1);
    });
  }

  protected clearPersonaFace(): void {
    this.persona.setImage('');
    this.personaVersion.update((v) => v + 1);
  }

  protected readonly releasesUrl = aiLinkBridgeUrl();
  protected readonly subscriptionGuideUrl = SUBSCRIPTION_GUIDE_URL;
  /** Which command was copied last, to say so beside it. */
  protected readonly copied = signal<'code' | 'desktop' | null>(null);

  /** Whether the seat may let the AI change the room at all: a seat that watches may not. */
  protected readonly mayWrite = computed(() => canRoleEdit(this.permission.role()));

  protected readonly stateKey = computed<AiLinkStateKey>(() => {
    const state = this.link.state();
    switch (state.kind) {
      case 'idle':
      case 'connecting':
      case 'connected':
        return state.kind;
      case 'refused':
        return state.reason;
      case 'lost':
        return state.unreachable ? 'unreachable' : 'lost';
    }
  });

  /** The bridge's version, to name in what the panel says. */
  protected readonly bridge = computed(() => {
    const state = this.link.state();
    return state.kind === 'connected' || state.kind === 'refused' ? state.bridge : '';
  });

  /** Whether the link is on, or being looked for: the button then lets go of it. */
  protected readonly linking = computed(() => {
    const kind = this.link.state().kind;
    return kind === 'connecting' || kind === 'connected' || kind === 'lost';
  });

  /** What the bridge is started with beyond the file: this page where the bridge does not trust it already, and the port. */
  protected readonly bridgeArgs = computed(() => {
    const args: string[] = [];
    const origin = globalThis.location?.origin ?? '';
    if (origin && !AGENT_TRUSTED_ORIGINS.includes(origin)) args.push('--allow-origin', origin);
    if (this.link.port() !== AGENT_BRIDGE_PORT) args.push('--port', String(this.link.port()));
    return args;
  });

  /** Whether this page has to be named to the bridge. */
  protected readonly untrustedOrigin = computed(() => this.bridgeArgs().includes('--allow-origin'));
  protected readonly origin = globalThis.location?.origin ?? '';

  protected readonly claudeCodeCommand = computed(() =>
    ['claude mcp add axe -- node /path/to/axe-mcp.mjs', ...this.bridgeArgs()].join(' ')
  );

  protected readonly claudeDesktopConfig = computed(() =>
    JSON.stringify(
      { mcpServers: { axe: { command: 'node', args: ['/path/to/axe-mcp.mjs', ...this.bridgeArgs()] } } },
      null,
      2
    )
  );

  /** The key of a tool's name as the history lists it, or null for a tool no longer defined. */
  protected nameKeyOf(tool: string): string | null {
    return agentToolOf(tool) ? `feature.aiLink.tools.${tool}` : null;
  }

  protected toggle(): void {
    if (this.linking()) this.link.disconnect();
    else this.link.connect();
  }

  protected setScope(scope: AgentScope): void {
    this.link.setScope(scope);
  }

  protected setPort(value: string): void {
    this.link.setPort(Number(value));
  }

  protected async copy(which: 'code' | 'desktop'): Promise<void> {
    const text = which === 'code' ? this.claudeCodeCommand() : this.claudeDesktopConfig();
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(which);
    } catch {
      this.copied.set(null);
    }
  }

  protected timeOf(at: number): string {
    return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
