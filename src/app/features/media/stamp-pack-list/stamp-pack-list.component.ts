import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { isStampProblem, StampPackService } from '@axe/application/media/stamp-pack.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { ConfirmService } from '@axe/application/ui/confirm.service';
import { ModalService } from '@axe/application/ui/modal.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { STAMP_LIMITS, StampItem, StampPack } from '@axe/domain/media/stamp-pack';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * The room's stamp packs, one tab to a pack and a grid of its pictures, where a seat that may
 * change the table makes, edits, saves and reads in packs.
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

  private readonly selectedPackId = signal<string | null>(null);
  private readonly selectedStampId = signal<string | null>(null);

  /** What the last action came to, shown under the grid until the next one. */
  protected readonly notice = signal('');
  protected readonly busy = signal(false);

  /** Every pack in the room, followed through additions, removals and renames. */
  protected readonly packs = computed(() => {
    this.objectChange.collectionOf(StampPack.aliasName)();
    const packs = this.stamps.packs();
    for (const pack of packs) this.objectChange.versionOf(pack.identifier)();
    return packs;
  });

  /** The pack whose tab is open: the one picked, or the first when that one is gone. */
  protected readonly selectedPack = computed<StampPack | null>(() => {
    const packs = this.packs();
    const id = this.selectedPackId();
    return packs.find((pack) => pack.identifier === id) ?? packs[0] ?? null;
  });

  protected readonly items = computed<readonly StampItem[]>(() => this.selectedPack()?.items ?? []);

  protected readonly selectedStamp = computed<StampItem | null>(() => {
    const id = this.selectedStampId();
    return this.items().find((item) => item.id === id) ?? null;
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
  }

  /** The picture to show for a stamp, the thumbnail where there is one, or nothing until it arrives. */
  protected imageUrlOf(item: StampItem): string {
    this.objectChange.fileVersion();
    const image = this.imageStorage.get(item.imageIdentifier);
    return image?.thumbnail.url || image?.url || '';
  }

  protected selectPack(pack: StampPack): void {
    this.selectedPackId.set(pack.identifier);
    this.selectedStampId.set(null);
  }

  protected selectStamp(item: StampItem): void {
    this.selectedStampId.set(this.selectedStampId() === item.id ? null : item.id);
  }

  protected createPack(): void {
    const result = this.stamps.createPack(this.t('feature.media.stamp.defaultPackName'));
    if (isStampProblem(result)) return this.report(result);
    this.selectPack(result);
    this.notice.set('');
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
    const pack = this.selectedPack();
    if (!pack || files.length === 0) return;
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

  protected renameStamp(item: StampItem, event: Event): void {
    const pack = this.selectedPack();
    if (!pack) return;
    this.report(this.stamps.updateStamp(pack, item.id, { name: (event.target as HTMLInputElement).value }));
    (event.target as HTMLInputElement).value = pack.itemOf(item.id)?.name ?? '';
  }

  protected changeWords(item: StampItem, event: Event): void {
    const pack = this.selectedPack();
    if (!pack) return;
    this.report(this.stamps.updateStamp(pack, item.id, { words: (event.target as HTMLInputElement).value }));
    (event.target as HTMLInputElement).value = pack.itemOf(item.id)?.words.join(' ') ?? '';
  }

  protected removeStamp(item: StampItem): void {
    const pack = this.selectedPack();
    if (!pack) return;
    this.report(this.stamps.removeStamp(pack, item.id));
    this.selectedStampId.set(null);
  }

  protected async exportPack(): Promise<void> {
    const pack = this.selectedPack();
    if (!pack) return;
    await this.whileBusy(() => this.stamps.exportPack(pack));
  }

  /** Reads a pack file in, asking first before it replaces a pack the room already has. */
  protected async importPack(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.canEdit()) return;
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

  private async whileBusy(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
    } finally {
      this.busy.set(false);
    }
  }

  private report(problem: string | null): void {
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
