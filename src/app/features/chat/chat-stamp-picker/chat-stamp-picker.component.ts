import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  output,
  signal,
} from '@angular/core';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { chatSyntaxExample, ChatSyntaxSnippet, chatSyntaxSnippets } from '@axe/domain/chat/chat-syntax-snippet';
import { CATALOG_EMOJIS } from '@axe/features/chat/chat-message-reactions/reaction-emoji-catalog';
import { TranslocoModule } from '@jsverse/transloco';

/** The tab of emoji every room has, whatever packs it holds. */
export const EMOJI_TAB = '';

/** The tab of the chat's own ways of writing; no pack is ever given this identifier. */
export const SYNTAX_TAB = 'chat-syntax';

/**
 * What the chat input's writing-tools button opens: a tab of emoji and one of the chat's own ways
 * of writing. Stamps are chosen from the shared picker beside the send button.
 *
 * Picking an emoji, a way of writing or a stamp reports it and leaves what happens next to the
 * input. The tabs step with the arrow keys, and Escape reports the picker closed. Focus goes to the
 * first choice when it opens, so a keyboard can go on from there.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'chat-stamp-picker',
  templateUrl: './chat-stamp-picker.component.html',
  host: { class: 'block', '(keydown.escape)': 'close($event)' },
  imports: [TranslocoModule],
})
export class ChatStampPickerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly t = inject(TRANSLATE_FN);

  readonly emojiPicked = output<string>();
  readonly syntaxPicked = output<ChatSyntaxSnippet>();
  readonly closed = output<void>();

  protected readonly emojiTab = EMOJI_TAB;
  protected readonly syntaxTab = SYNTAX_TAB;
  protected readonly emojis = CATALOG_EMOJIS;
  protected readonly exampleOf = chatSyntaxExample;

  protected readonly snippets = chatSyntaxSnippets({
    rubyBase: this.t('feature.chat.syntax.placeholder.rubyBase'),
    rubyReading: this.t('feature.chat.syntax.placeholder.rubyReading'),
    resource: this.t('feature.chat.syntax.placeholder.resource'),
    buffName: this.t('feature.chat.syntax.placeholder.buffName'),
    effectName: this.t('feature.chat.syntax.placeholder.effectName'),
  });

  private readonly selectedTab = signal(EMOJI_TAB);

  /** The text tool open: syntax, or emoji when none is. */
  readonly activeTab = computed(() => (this.selectedTab() === SYNTAX_TAB ? SYNTAX_TAB : EMOJI_TAB));

  constructor() {
    this.focusAfterRender('[data-testid="chat-emoji-choice"], [data-testid="chat-syntax-choice"]');
  }

  /** The element the picker is drawn in, for the input to tell a press inside it from one elsewhere. */
  contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.host.nativeElement.contains(target);
  }

  selectTab(tab: string): void {
    this.selectedTab.set(tab);
  }

  protected pickEmoji(emoji: string): void {
    this.emojiPicked.emit(emoji);
  }

  protected pickSyntax(snippet: ChatSyntaxSnippet): void {
    this.syntaxPicked.emit(snippet);
  }

  /** The left and right arrows, and Home and End, move between the tabs and open the one reached. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const tabs = [EMOJI_TAB, SYNTAX_TAB];
    const index = tabs.indexOf(this.activeTab());
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.selectTab(tabs[next]);
    this.focusAfterRender('[role="tab"][aria-selected="true"]');
  }

  protected close(event: Event): void {
    event.stopPropagation();
    this.closed.emit();
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(
      { write: () => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus() },
      {
        injector: this.injector,
      }
    );
  }
}
