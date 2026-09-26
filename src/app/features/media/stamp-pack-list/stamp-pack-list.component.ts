import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { isStampProblem, StampEditProblem, StampPackService } from '@axe/application/media/stamp-pack.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ConfirmService } from '@axe/application/ui/confirm.service';
import { ModalService } from '@axe/application/ui/modal.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { BUILTIN_STAMP_PACK_IDENTIFIER, builtinStampPack, StampPackView } from '@axe/domain/media/builtin-stamps';
import { normalizeStampWords, STAMP_LIMITS, StampItem, stampLabelOf, StampPack } from '@axe/domain/media/stamp-pack';
import { FileSelecterComponent } from '@axe/ui/components/file-selecter/file-selecter.component';
import { TranslocoModule } from '@jsverse/transloco';

/** How long typing in the search words may pause before what was typed is saved. */
const WORDS_SAVE_DELAY_MS = 600;

/** Where the search words being typed stand: not yet saved, or saved just now. */
type WordsState = 'idle' | 'pending' | 'saved';

/**
 * The room's stamp packs, one tab to a pack and a grid of its pictures, where a seat that may
 * change the table makes, edits, saves and reads in packs. The tool's own stamps have a tab of
 * their own, to look at and nothing more.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stamp-pack-list',
  templateUrl: './stamp-pack-list.component.html',
  imports: [TranslocoModule],
})
export class StampPackListComponent {
  private readonly stamps = inject(StampPackService);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageStorage = inject(ImageStorage);
  private readonly confirm = inject(ConfirmService);
  private readonly modalService = inject(ModalService);
  private readonly panelService = inject(PanelService);
  private readonly t = inject(TRANSLATE_FN);

  protected readonly limits = STAMP_LIMITS;
  protected readonly labelOf = stampLabelOf;
  protected readonly builtinId = BUILTIN_STAMP_PACK_IDENTIFIER;

  private readonly selectedPackId = signal<string | null>(null);
  private readonly selectedStampId = signal<string | null>(null);

  /** What the last action came to, shown under the grid until the next one. */
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  /** Whether files are being dragged over the panel, to be dropped in as stamps. */
  protected readonly dragging = signal(false);

  /** The search words typed for a stamp and not saved yet. */
  private readonly wordsDraft = signal<{ readonly id: string; readonly text: string } | null>(null);
  protected readonly wordsState = signal<WordsState>('idle');
  private wordsTimer: ReturnType<typeof setTimeout> | null = null;

  /** Every pack in the room, followed through additions, removals and renames. */
  protected readonly packs = computed(() => {
    this.objectChange.collectionOf(StampPack.aliasName)();
    const packs = this.stamps.packs();
    for (const pack of packs) this.objectChange.versionOf(pack.identifier)();
    return packs;
  });

  /** The tool's own stamps, under a name in the reader's language. */
  protected readonly builtinPack: StampPackView = builtinStampPack(this.t('feature.media.stamp.builtinPack'));

  /** Whether the tab open is the tool's own stamps. */
  protected readonly showsBuiltin = computed(
    () => this.selectedPackId() === BUILTIN_STAMP_PACK_IDENTIFIER || this.packs().length === 0
  );

  /** The room pack whose tab is open: the one picked, or the first when that one is gone. */
  protected readonly selectedPack = computed<StampPack | null>(() => {
    if (this.showsBuiltin()) return null;
    const packs = this.packs();
    const id = this.selectedPackId();
    return packs.find((pack) => pack.identifier === id) ?? packs[0] ?? null;
  });

  /**
   * The stamps of the pack open. The pack stays the same object while its stamps change, so its
   * version is what is followed; without it a stamp just added showed only once the tab changed.
   */
  protected readonly items = computed<readonly StampItem[]>(() => {
    const pack = this.selectedPack();
    if (!pack) return [];
    this.objectChange.versionOf(pack.identifier)();
    return pack.items;
  });

  protected readonly selectedStamp = computed<StampItem | null>(() => {
    const id = this.selectedStampId();
    return this.items().find((item) => item.id === id) ?? null;
  });

  /** The stamp being edited, as a list of none or one, so the editor is drawn anew for each stamp. */
  protected readonly editedStamps = computed<StampItem[]>(() => {
    const stamp = this.selectedStamp();
    return stamp ? [stamp] : [];
  });

  /** Whether this seat may change the packs, which a seat only watching may not. */
  protected readonly canEdit = computed(() => {
    this.objectChange.trackMyCursor();
    return this.stamps.canEdit;
  });

  constructor() {
    queueMicrotask(
      () => (this.modalService.title = this.panelService.title = this.t('feature.media.stamp.panelTitle'))
    );
    // Words typed and not yet saved are saved as the panel closes, not dropped.
    inject(DestroyRef).onDestroy(() => this.saveWords());
  }

  /** The picture to show for a stamp, the thumbnail where there is one, or nothing until it arrives. */
  protected imageUrlOf(item: StampItem): string {
    this.objectChange.fileVersion();
    const image = this.imageStorage.get(item.imageIdentifier);
    return image?.thumbnail.url || image?.url || '';
  }

  protected selectPack(pack: StampPackView): void {
    this.saveWords();
    this.wordsState.set('idle');
    this.selectedPackId.set(pack.identifier);
    this.selectedStampId.set(null);
  }

  protected selectStamp(item: StampItem): void {
    this.saveWords();
    this.wordsState.set('idle');
    this.selectedStampId.set(this.selectedStampId() === item.id ? null : item.id);
  }

  protected createPack(): void {
    this.createAndSelectPack();
  }

  protected renamePack(event: Event): void {
    const pack = this.selectedPack();
    if (!pack) return;
    const input = event.target as HTMLInputElement;
    this.report(this.stamps.renamePack(pack, input.value));
    input.value = pack.name;
  }

  protected async deletePack(): Promise<void> {
    const pack = this.selectedPack();
    if (!pack || !this.canEdit()) return;
    const agreed = await this.confirm.ask({
      title: this.t('feature.media.stamp.deletePack'),
      message: this.t('feature.media.stamp.deletePackConfirm', { name: pack.name, count: pack.items.length }),
      okLabel: this.t('feature.media.stamp.deletePack'),
      danger: true,
    });
    if (!agreed) return;
    this.report(this.stamps.deletePack(pack));
    this.selectedPackId.set(null);
    this.selectedStampId.set(null);
  }

  protected async addStamps(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    await this.addStampFiles(files);
  }

  /** Opens the room's pictures to pick one from, and makes the one picked a stamp of the open pack. */
  protected async addFromRoomImages(): Promise<void> {
    const pack = this.selectedPack();
    if (!pack || !this.canEdit()) return;
    const identifier = await this.modalService.open<string>(FileSelecterComponent).catch(() => null);
    if (typeof identifier !== 'string' || identifier.length === 0) return;
    await this.whileBusy(async () => {
      const result = await this.stamps.addStampFromImage(pack, identifier);
      if (isStampProblem(result)) return this.report(result);
      this.selectedStampId.set(result.id);
      this.notice.set('');
    });
  }

  protected onDragOver(event: DragEvent): void {
    if (!this.acceptsDrop(event)) return;
    // Held here, or the room would read the files in as it does anything dropped on it.
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    const into = event.relatedTarget as Node | null;
    if (into && (event.currentTarget as Node).contains(into)) return;
    this.dragging.set(false);
  }

  /**
   * Pictures dropped on the panel become stamps of the open pack, one made for them where there
   * is none; a pack file dropped is read in as one.
   */
  protected async onDrop(event: DragEvent): Promise<void> {
    if (!this.acceptsDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    const archive = files.find((file) => /\.zip$/i.test(file.name) || file.type.includes('zip'));
    if (archive) return this.importPackFile(archive);
    await this.addStampFiles(files);
  }

  /** Keeps the words as they are typed, and saves them once typing pauses. */
  protected typeWords(item: StampItem, event: Event): void {
    this.wordsDraft.set({ id: item.id, text: (event.target as HTMLInputElement).value });
    this.wordsState.set('pending');
    this.clearWordsTimer();
    this.wordsTimer = setTimeout(() => this.saveWords(), WORDS_SAVE_DELAY_MS);
  }

  /** Saves the words typed at once, as the box is left or Enter is pressed, and shows them as kept. */
  protected commitWords(event: Event): void {
    this.saveWords();
    const input = event.target as HTMLInputElement;
    const saved = this.selectedStamp();
    if (saved && document.activeElement !== input) input.value = saved.words.join(' ');
  }

  /** What the words box shows: what is being typed for the stamp, or else the words it has. */
  protected wordsTextOf(item: StampItem): string {
    const draft = this.wordsDraft();
    return draft?.id === item.id ? draft.text : item.words.join(' ');
  }

  protected removeStamp(item: StampItem): void {
    const pack = this.selectedPack();
    if (!pack) return;
    this.discardWords();
    this.report(this.stamps.removeStamp(pack, item.id));
    this.selectedStampId.set(null);
  }

  protected async exportPack(): Promise<void> {
    const pack = this.selectedPack();
    if (!pack) return;
    this.saveWords();
    await this.whileBusy(() => this.stamps.exportPack(pack));
  }

  /** Reads a pack file in, asking first before it replaces a pack the room already has. */
  protected async importPack(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.importPackFile(file);
  }

  private async importPackFile(file: File): Promise<void> {
    if (!this.canEdit()) return;
    await this.whileBusy(async () => {
      const archive = await this.stamps.readArchive(file);
      if (isStampProblem(archive)) return this.report(archive);
      const existing = this.stamps.existingPackOf(archive);
      if (existing) {
        const agreed = await this.confirm.ask({
          title: this.t('feature.media.stamp.import'),
          message: this.t('feature.media.stamp.replaceConfirm', {
            name: existing.name,
            incoming: archive.name,
            count: archive.items.length,
          }),
          okLabel: this.t('feature.media.stamp.replace'),
        });
        if (!agreed) return;
      }
      const result = await this.stamps.importArchive(archive);
      if (isStampProblem(result)) return this.report(result);
      this.selectPack(result);
      this.notice.set(this.t('feature.media.stamp.imported', { name: result.name, count: result.items.length }));
    });
  }

  /**
   * Makes each picture a stamp of the open pack. With the tool's tab open it goes to the room's
   * first pack, and with no pack at all one is made for it.
   */
  private async addStampFiles(files: File[]): Promise<void> {
    if (files.length === 0 || !this.canEdit()) return;
    let pack = this.selectedPack();
    if (!pack) {
      pack = this.packs()[0] ?? this.createAndSelectPack();
      if (pack) this.selectPack(pack);
    }
    if (!pack) return;
    await this.whileBusy(async () => {
      const problems: string[] = [];
      let added: StampItem | null = null;
      for (const file of files) {
        const result = await this.stamps.addStamp(pack, file);
        if (isStampProblem(result)) problems.push(this.problemText(result, file.name));
        else added = result;
        if (result === 'stampLimit' || result === 'forbidden') break;
      }
      if (added) this.selectedStampId.set(added.id);
      this.notice.set(problems.join(' '));
    });
  }

  private createAndSelectPack(): StampPack | null {
    const result = this.stamps.createPack(this.t('feature.media.stamp.defaultPackName'));
    if (isStampProblem(result)) {
      this.report(result);
      return null;
    }
    this.selectPack(result);
    this.notice.set('');
    return result;
  }

  /** Only files, and only for a seat that may change the packs; anything else is the room's to handle. */
  private acceptsDrop(event: DragEvent): boolean {
    return this.canEdit() && !this.busy() && Array.from(event.dataTransfer?.types ?? []).includes('Files');
  }

  /** Saves the words typed and not yet saved, if they differ from what the stamp already has. */
  private saveWords(): void {
    this.clearWordsTimer();
    const draft = this.wordsDraft();
    if (!draft) return;
    this.wordsDraft.set(null);
    const pack = this.selectedPack();
    const item = pack?.itemOf(draft.id);
    if (!pack || !item) return this.wordsState.set('idle');
    // Nothing changed is not written, so leaving the box is not sent to the whole room.
    if (normalizeStampWords(draft.text).join(' ') === item.words.join(' ')) return this.wordsState.set('saved');
    const problem = this.stamps.updateStamp(pack, draft.id, { words: draft.text });
    this.report(problem);
    this.wordsState.set(problem ? 'idle' : 'saved');
  }

  private discardWords(): void {
    this.clearWordsTimer();
    this.wordsDraft.set(null);
    this.wordsState.set('idle');
  }

  private clearWordsTimer(): void {
    if (this.wordsTimer === null) return;
    clearTimeout(this.wordsTimer);
    this.wordsTimer = null;
  }

  private async whileBusy(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
    } finally {
      this.busy.set(false);
    }
  }

  private report(problem: StampEditProblem | string | null): void {
    this.notice.set(problem ? this.problemText(problem) : '');
  }

  private problemText(problem: string, fileName?: string): string {
    const text = this.t(`feature.media.stamp.problem.${problem}`, this.limitParams());
    return fileName ? `${fileName}: ${text}` : text;
  }

  private limitParams(): Record<string, number> {
    return {
      packs: STAMP_LIMITS.packsPerRoom,
      stamps: STAMP_LIMITS.stampsPerPack,
      side: STAMP_LIMITS.imageSide,
      kilobytes: STAMP_LIMITS.imageBytes / 1024,
    };
  }
}
