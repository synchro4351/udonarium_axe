import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { ChatReactionService } from '@axe/application/chat/chat-reaction.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ChatMessage } from '@axe/domain/chat/chat-message';
import { type ChatReactionCount, DEFAULT_REACTION_EMOJIS } from '@axe/domain/chat/chat-reaction';
import { searchReactionEmojis } from '@axe/features/chat/chat-message-reactions/reaction-emoji-catalog';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * The emoji reactions under a chat line: a chip for each emoji left, with how many left it, and the
 * picker for leaving one.
 *
 * A chip the reader left is marked, and pressing any chip leaves that emoji or takes the reader's
 * back. The picker opens from the line's own button, from its menu on a touch screen, or from the
 * small button after the chips. Nothing is drawn for a line nobody reacted to until the picker opens.
 *
 * The picker offers a few quick choices and a search field that finds others by name, in any of the
 * languages offered, or takes one emoji pasted or typed from the device's emoji keyboard. Text that
 * is not a single emoji is never offered.
 */
@Component({
  selector: 'chat-message-reactions',
  templateUrl: './chat-message-reactions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class ChatMessageReactionsComponent {
  readonly message = input.required<ChatMessage>();
  /** Whether the line is only to be read, as in a window that follows a tab going past. */
  readonly readOnly = input(false);

  private readonly reactionService = inject(ChatReactionService);
  private readonly changes = inject(ObjectChangeService);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly isPickerOpen = signal(false);
  /** What the reader typed into the picker's search: a name to look for, or an emoji pasted in. */
  readonly query = signal('');

  /** The quick choices while the search is empty, otherwise what it found. */
  readonly choices = computed<readonly string[]>(() =>
    this.query().trim().length === 0 ? DEFAULT_REACTION_EMOJIS : searchReactionEmojis(this.query())
  );

  /** The reactions this reader may see, redrawn whenever a reader's reactions under the line change. */
  readonly reactions = computed<readonly ChatReactionCount[]>(() => {
    const message = this.message();
    this.follow(message);
    return this.reactionService.reactionsOf(message);
  });

  /** Whether this reader may leave a reaction here. */
  readonly canReact = computed(() => {
    const message = this.message();
    this.follow(message);
    return !this.readOnly() && this.reactionService.canReact(message);
  });

  /**
   * Opens the picker, where the reader may react, and puts focus on its first choice so a keyboard
   * can go on from there wherever it was opened from. A button rather than the search field takes
   * it, so a touch screen does not raise its keyboard over the choices.
   */
  openPicker(): void {
    if (!this.canReact()) return;
    this.query.set('');
    this.isPickerOpen.set(true);
    this.focusAfterRender('[data-testid="chat-reaction-choice"]');
  }

  togglePicker(): void {
    if (this.isPickerOpen()) {
      this.closePicker();
      return;
    }
    this.openPicker();
  }

  /** Leaves the emoji, or takes the reader's back when already left, and closes the picker. */
  toggle(emoji: string): void {
    this.closePicker();
    if (!this.canReact()) return;
    this.reactionService.toggle(this.message(), emoji);
  }

  protected onQueryInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /**
   * Enter leaves the first emoji offered, so a pasted emoji or a name typed in can be left without
   * leaving the field, and the down arrow steps into the choices. Enter that ends an IME
   * composition is left to the IME.
   */
  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = this.query().trim().length > 0 ? this.choices()[0] : undefined;
      if (first) this.toggle(first);
    } else if (event.key === 'ArrowDown') {
      const choice = this.host.nativeElement.querySelector<HTMLElement>('[data-testid="chat-reaction-choice"]');
      if (!choice) return;
      event.preventDefault();
      choice.focus();
    }
  }

  protected onPickerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    this.closePicker();
  }

  /** Closes the picker, handing focus to the add button when it was inside, so it is not lost. */
  private closePicker(): void {
    const picker = this.host.nativeElement.querySelector('[data-testid="chat-reaction-picker"]');
    const hadFocus = picker?.contains(document.activeElement) ?? false;
    this.isPickerOpen.set(false);
    this.query.set('');
    if (hadFocus) this.focusAfterRender('[data-testid="chat-reaction-add"]', '[data-testid="chat-message-react"]');
  }

  private focusAfterRender(selector: string, fallback?: string): void {
    afterNextRender(
      {
        write: () => {
          const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
          const fallbackTarget = fallback
            ? this.host.nativeElement.closest('chat-message')?.querySelector<HTMLElement>(fallback)
            : null;
          (target ?? fallbackTarget)?.focus();
        },
      },
      {
        injector: this.injector,
      }
    );
  }

  private follow(message: ChatMessage): void {
    // The line's version moves when a reader's node beneath it does, and the tab's and the
    // reader's own cursor carry who may see and speak there.
    this.changes.versionOf(message.identifier)();
    this.changes.versionOf(message.tabIdentifier)();
    this.changes.trackMyCursor();
  }
}
