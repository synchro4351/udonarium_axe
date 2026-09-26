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
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { StampItem, StampPack } from '@axe/domain/media/stamp-pack';
import { CATALOG_EMOJIS } from '@axe/features/chat/chat-message-reactions/reaction-emoji-catalog';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

/** A stamp picked to be sent, with the pack it came from. */
export interface PickedStamp {
  readonly pack: StampPack;
  readonly item: StampItem;
}

/** The tab of emoji every room has, whatever packs it holds. */
export const EMOJI_TAB = '';

/**
 * What the chat input's stamp button opens: a tab of emoji, always there, and a tab for each of
 * the room's stamp packs.
 *
 * Picking an emoji or a stamp reports it and leaves what happens next to the input. The tabs step
 * with the arrow keys, and Escape reports the picker closed. Focus goes to the first choice when it
 * opens, so a keyboard can go on from there.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'chat-stamp-picker',
  templateUrl: './chat-stamp-picker.component.html',
  host: { class: 'block', '(keydown.escape)': 'close($event)' },
  imports: [SafePipe, TranslocoModule],
})
export class ChatStampPickerComponent {
  private readonly objectStore = inject(ObjectStore);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageStorage = inject(ImageStorage);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly emojiPicked = output<string>();
  readonly stampPicked = output<PickedStamp>();
  readonly closed = output<void>();

  protected readonly emojiTab = EMOJI_TAB;
  protected readonly emojis = CATALOG_EMOJIS;

  /** The room's packs, followed through additions, removals and changes to their stamps. */
  readonly packs = computed(() => {
    this.objectChange.collectionOf(StampPack.aliasName)();
    const packs = this.objectStore.getObjects(StampPack);
    for (const pack of packs) this.objectChange.versionOf(pack.identifier)();
    return packs;
  });

  private readonly selectedTab = signal(EMOJI_TAB);

  /** The tab open: the one picked, or the emoji when that pack has gone. */
  readonly activeTab = computed(() => {
    const tab = this.selectedTab();
    return this.packs().some((pack) => pack.identifier === tab) ? tab : EMOJI_TAB;
  });

  readonly activePack = computed(() => this.packs().find((pack) => pack.identifier === this.activeTab()) ?? null);

  constructor() {
    this.focusAfterRender('[data-testid="chat-emoji-choice"], [data-testid="chat-stamp-choice"]');
  }

  selectTab(tab: string): void {
    this.selectedTab.set(tab);
  }

  /** The picture to show for a stamp, the thumbnail where there is one, or nothing until it arrives. */
  protected imageUrlOf(item: StampItem): string {
    this.objectChange.fileVersion();
    const image = this.imageStorage.get(item.imageIdentifier);
    return image?.thumbnail.url || image?.url || '';
  }

  protected pickEmoji(emoji: string): void {
    this.emojiPicked.emit(emoji);
  }

  protected pickStamp(pack: StampPack, item: StampItem): void {
    this.stampPicked.emit({ pack, item });
  }

  /** The left and right arrows, and Home and End, move between the tabs and open the one reached. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const tabs = [EMOJI_TAB, ...this.packs().map((pack) => pack.identifier)];
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
