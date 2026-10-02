import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ViewportService } from '@axe/application/ui/viewport.service';
import { emitSelectFile } from '@axe/core/event/domain-events';
import { FileArchiver, ImageDropPlace } from '@axe/core/storage/file-archiver';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { canBrowseImage, ImageTag, SYSTEM_RESERVED_TAG } from '@axe/domain/media/image-tag';
import {
  ClipboardImageResult,
  imageFromPaste,
  isPasteableImage,
  readClipboardImage,
} from '@axe/features/file/file-storage/clipboard-image';
import {
  DroppedImageEventHandlerService,
  DroppedImageHolder,
  UnconfirmedImage,
} from '@axe/features/file/file-storage/dropped-image-event-handler.service';
import {
  canClearBackground,
  clearBackgroundAt,
  PickedColor,
} from '@axe/features/file/file-storage/transparent-background';
import { MultipartCharacterComponent } from '@axe/features/file/multipart-character/multipart-character.component';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

const ALL_TAG = '__all__';

type PendingNotice =
  | Exclude<ClipboardImageResult['kind'], 'image'>
  | 'noPermission'
  | 'oversized'
  | 'duplicate'
  | 'added'
  | 'failed'
  | 'pickMissed'
  | 'clearFailed'
  | 'previousAdded'
  | 'previousDuplicate'
  | 'keptOversized'
  | 'keptFailed'
  | 'keptNoPermission'
  | 'returned';

/** The message shown for each outcome of pasting or choosing a picture and adding it. */
export const PENDING_NOTICE_KEYS: Readonly<Record<PendingNotice, string>> = {
  none: 'feature.file.fileStorage.paste.none',
  unsupported: 'feature.file.fileStorage.paste.unsupported',
  unreadable: 'feature.file.fileStorage.paste.unreadable',
  noPermission: 'feature.file.fileStorage.pending.noPermission',
  oversized: 'feature.file.fileStorage.pending.oversized',
  duplicate: 'feature.file.fileStorage.pending.duplicate',
  added: 'feature.file.fileStorage.pending.added',
  failed: 'feature.file.fileStorage.pending.failed',
  pickMissed: 'feature.file.fileStorage.transparent.missed',
  clearFailed: 'feature.file.fileStorage.transparent.failed',
  previousAdded: 'feature.file.fileStorage.pending.previousAdded',
  previousDuplicate: 'feature.file.fileStorage.pending.previousDuplicate',
  keptOversized: 'feature.file.fileStorage.pending.keptOversized',
  keptFailed: 'feature.file.fileStorage.pending.keptFailed',
  keptNoPermission: 'feature.file.fileStorage.pending.keptNoPermission',
  returned: 'feature.file.fileStorage.pending.returned',
};

/** The outcomes that are good news, shown without the warning colour. */
const GOOD_NOTICES: ReadonlySet<PendingNotice> = new Set(['added', 'previousAdded']);

/** A picture held for the user to look over, with the object URL its preview is shown from. */
interface HeldFile {
  readonly file: File;
  readonly url: string;
}

/**
 * A picture waiting for the user to add it, the transparent copy made of it, if any, and where it
 * was dropped, if it was, so that adding it places it there as an unconfirmed drop would have.
 */
export interface PendingImage {
  readonly original: HeldFile;
  readonly transparent: (HeldFile & { readonly color: PickedColor }) | null;
  readonly place: ImageDropPlace | null;
}

@Component({
  selector: 'file-storage',
  templateUrl: './file-storage.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SafePipe, TranslocoModule],
})
export class FileStorageComponent implements DroppedImageHolder {
  protected readonly isCompact = inject(ViewportService).isCompact;
  private readonly panelService = inject(PanelService);
  private readonly imageStorage = inject(ImageStorage);
  private readonly fileArchiver = inject(FileArchiver);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly rolePermission = inject(RolePermissionService);
  private readonly droppedImages = inject(DroppedImageEventHandlerService);
  private readonly t = inject(TRANSLATE_FN);
  private readonly multipart = inject(MultipartCharacterService);

  get canCreateParts(): boolean {
    this.objectChange.fileVersion();
    this.objectChange.collectionOf('image-tag')();
    const identifier = [...this.checkedFiles][0];
    if (identifier) this.objectChange.versionOf(`imagetag_${identifier}`)();
    const image = identifier ? this.imageStorage.get(identifier) : null;
    return this.checkedFiles.size === 1 && !!image && this.mayShow(image) && this.multipart.mayUse(identifier);
  }

  openMultipart(): void {
    if (!this.canCreateParts) return;
    const component = this.panelService.open(MultipartCharacterComponent, {
      title: this.t('feature.file.multipart.title'),
      width: 680,
      height: 650,
      minWidth: 300,
      minHeight: 400,
    });
    void component.initialize([...this.checkedFiles][0]);
  }

  /** The label shown for a tag in the tag filter, with the all and untagged entries translated. */
  displayTagName(tag: string): string {
    if (tag === ALL_TAG) return this.t('feature.file.fileStorage.all');
    if (!tag) return this.t('feature.file.fileStorage.unset');
    return tag;
  }

  protected checkedFiles = new Set<string>();

  /** Only the master may keep a picture back, or see one that is being kept. */
  get canKeepSecret(): boolean {
    return this.rolePermission.canSeeHidden;
  }

  /** The master's own view of what is being kept. Everyone else never sees them at all. */
  readonly showSecret = signal(true);

  private mayShow(imageFile: ImageFile): boolean {
    return canBrowseImage(ImageTag.get(imageFile.context.identifier) ?? null, this.canKeepSecret, this.showSecret());
  }

  /**
   * Every stored picture this seat may see whatever its tag, following the master's switch for
   * showing kept-back pictures.
   */
  getAllImage(): ImageFile[] {
    return this.fileStorageService.images.filter((imageFile) => this.mayShow(imageFile));
  }

  readonly images = computed(() => {
    this.objectChange.fileVersion();
    this.objectChange.collectionOf('image-tag')();
    const imageFileList: ImageFile[] = [];
    if (this.selectTag() == ALL_TAG) return this.getAllImage();
    for (const imageFile of this.fileStorageService.images) {
      const identifier = imageFile.context.identifier;
      const imageTag = ImageTag.get(identifier);

      if (imageTag) {
        this.objectChange.versionOf(imageTag.identifier)();
        const tag: string = imageTag.tag;
        if (tag == this.selectTag() && this.mayShow(imageFile)) {
          imageFileList.push(imageFile);
        }
      } else if (this.selectTag() == '') {
        imageFileList.push(imageFile);
      }
    }
    return imageFileList;
  });

  selectedFile: ImageFile | null = null;
  /** Whether a picture has been selected. */
  get isSelected(): boolean {
    return this.selectedFile !== null;
  }
  /**
   * The tag record of the selected picture, or null with nothing selected.
   *
   * A picture without one gets a new tag record on the spot, which is shared with the room.
   */
  get selectedImageTag(): ImageTag | null {
    if (!this.isSelected || this.selectedFile === null) return null;
    const imageTag = ImageTag.get(this.selectedFile.identifier);
    return imageTag ? imageTag : ImageTag.create(this.selectedFile.identifier);
  }

  readonly tagList = computed<string[]>(() => {
    this.objectChange.fileVersion();
    this.objectChange.collectionOf('image-tag')();
    const tags: string[] = [];
    for (const imageFile of this.fileStorageService.images) {
      const identifier = imageFile.context.identifier;
      const imageTag = ImageTag.get(identifier);
      if (imageTag) {
        this.objectChange.versionOf(imageTag.identifier)();
        if (imageTag.tag && imageTag.tag != SYSTEM_RESERVED_TAG) tags.push(imageTag.tag);
      }
    }

    const tags2: string[] = Array.from(new Set(tags));
    tags2.unshift(ALL_TAG);
    tags2.unshift('');
    return tags2;
  });

  fileStorageService = this.imageStorage;

  /** Keeps the tag name typed into the new-tag field. */
  onInputNewTag(event: Event): void {
    this.newTagName.set((event.target as HTMLInputElement).value);
  }

  /**
   * Files every ticked picture in the current list under the typed tag.
   *
   * Typing the untagged label clears their tag instead. The names reserved for all pictures and for
   * the tool's own pictures are refused. Tag records are shared, so the change reaches every peer.
   */
  changeTag() {
    const candidate = this.newTagName();
    if (candidate === ALL_TAG) return;
    if (candidate === SYSTEM_RESERVED_TAG) return;
    if (candidate === this.t('feature.file.fileStorage.all')) return;

    const changeableImages = this.images();

    for (const img of changeableImages) {
      if (this.checkedFiles.has(img.context.identifier)) {
        let imageTag = ImageTag.get(img.context.identifier);
        imageTag = imageTag ? imageTag : ImageTag.create(img.context.identifier);
        if (candidate === this.t('feature.file.fileStorage.unset')) {
          imageTag.tag = '';
        } else {
          imageTag.tag = candidate;
        }
      }
    }
  }

  /** Whether the picture is being kept back by the master. */
  isSecret(file: ImageFile): boolean {
    return ImageTag.isSecret(file.context.identifier);
  }

  /** Keeps back, or gives up, every picture ticked. Only the master may. */
  setCheckedSecret(secret: boolean): void {
    if (!this.canKeepSecret) return;

    for (const image of this.images()) {
      const identifier = image.context.identifier;
      if (!this.checkedFiles.has(identifier)) continue;
      const tag = ImageTag.get(identifier) ?? ImageTag.create(identifier);
      // What the tool brought with it is nobody's to keep or to give up.
      if (tag.tag === SYSTEM_RESERVED_TAG) continue;
      tag.isSecret = secret;
    }
  }

  readonly selectTag = signal('');
  readonly newTagName = signal<string>('');

  /** Runs when the tag filter changes; it does nothing. */
  resetBtn() {}

  constructor() {
    queueMicrotask(() => (this.panelService.title = this.t('common.panel.fileStorage')));
    const detach = this.droppedImages.attach(this);
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      detach();
      void this.handOverUnconfirmed();
    });
  }

  /**
   * Loads the files chosen in the upload dialog into storage, then clears the input so the same
   * file can be chosen again.
   *
   * A single picture is held for the user to look over first, as a pasted one is, so its background
   * can be made transparent. Several files, or one the preview cannot show, load straight away.
   * A seat that may not edit the table loads nothing.
   */
  handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!this.rolePermission.canEditTabletop) {
      input.value = '';
      return;
    }
    const files = input.files;
    if (files?.length === 1 && isPasteableImage(files[0].type)) {
      void this.offer({ kind: 'image', file: files[0] });
    } else if (files && files.length) {
      this.fileArchiver.load(files);
    }
    input.value = '';
  }

  private readonly pasteBox = viewChild<ElementRef<HTMLElement>>('pasteBox');
  private destroyed = false;

  /** The picture pasted or chosen and waiting for the user to add it or not. */
  readonly pendingImage = signal<PendingImage | null>(null);
  /** What the last paste, pick or add came to, shown under the paste box; null shows nothing. */
  readonly pendingNotice = signal<PendingNotice | null>(null);
  readonly pendingAdding = signal(false);
  /** Whether the held picture may have its background cleared; a moving picture may not. */
  readonly canClearPending = signal(false);
  /** Whether the next click on the preview picks the colour to clear. */
  readonly pickingColor = signal(false);
  readonly clearingColor = signal(false);
  protected readonly pendingNoticeKeys = PENDING_NOTICE_KEYS;
  protected readonly goodNotices = GOOD_NOTICES;

  /** The held picture being stored, until it is; another arrival waits for it rather than storing it again. */
  private adding: Promise<PendingNotice> | null = null;
  /** The transparent copy being made, until it is shown; another arrival waits so the copy is what gets added. */
  private clearing: Promise<void> | null = null;
  /** The last picture or clipboard reading to arrive, which the next one waits for, so they are taken in turn. */
  private intake: Promise<void> | null = null;
  /** Pictures that have arrived but are not yet held, in the order they came. */
  private readonly arrivals: UnconfirmedImage[] = [];

  /** Makes the transparent copy; a test stands in for it, having no canvas to draw on. */
  protected clearBackground = clearBackgroundAt;
  /** Tells whether a picture may be cleared; a test stands in for it. */
  protected canClear = canClearBackground;

  /**
   * Takes the picture from a paste made while the paste box, or a button in it, has focus, holding
   * it for confirmation rather than storing it. Pastes anywhere else never reach here.
   */
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    if (!this.rolePermission.canEditTabletop) {
      this.pendingNotice.set('noPermission');
      return;
    }
    void this.offer(imageFromPaste(event.clipboardData));
  }

  /** Reads a picture from the clipboard on request, holding it for confirmation. */
  async readFromClipboard(): Promise<void> {
    if (!this.rolePermission.canEditTabletop) {
      this.pendingNotice.set('noPermission');
      return;
    }
    const result = await readClipboardImage(navigator.clipboard);
    await this.offer(result);
  }

  /**
   * Holds a picture dropped on the page for confirmation, to be placed where it was dropped once
   * added, or one a closed panel could not add, with a warning saying so.
   */
  holdDroppedImage(file: File, place: ImageDropPlace | null, returned = false): void {
    void this.offer({ kind: 'image', file }, place, returned);
  }

  /**
   * Stores the held picture, or its transparent copy when one was made, the same way the upload
   * dialog does, so the usual size limit applies and the room is told of it like any other picture.
   * A picture already stored is reported as a duplicate. One that could not be stored stays held.
   */
  async confirmPending(): Promise<void> {
    const pending = this.pendingImage();
    if (!pending || this.adding || this.clearingColor()) return;
    this.pendingNotice.set(await this.add(pending));
    this.pasteBox()?.nativeElement.focus();
  }

  /** Drops the held picture, and any transparent copy of it, without storing either. */
  cancelPending(): void {
    if (this.pendingAdding()) return;
    this.dropPendingImage();
    this.pendingNotice.set(null);
    this.pasteBox()?.nativeElement.focus();
  }

  /** Starts, or stops, picking the colour to clear with a click on the preview. */
  togglePicking(): void {
    if (!this.pendingImage() || !this.canClearPending()) return;
    this.pickingColor.update((picking) => !picking);
  }

  /**
   * Clears the colour under a click on the preview, always from the original so that picking
   * again starts over rather than clearing a second colour.
   */
  async pickColor(event: MouseEvent): Promise<void> {
    const pending = this.pendingImage();
    const preview = event.currentTarget as HTMLElement | null;
    if (!pending || !preview || !this.pickingColor() || this.clearingColor()) return;
    this.clearingColor.set(true);
    const clearing = this.clearWith(
      pending,
      { x: event.offsetX, y: event.offsetY },
      { width: preview.clientWidth, height: preview.clientHeight }
    );
    this.clearing = clearing;
    await clearing;
    if (this.clearing === clearing) this.clearing = null;
  }

  private async clearWith(
    pending: PendingImage,
    point: { x: number; y: number },
    size: { width: number; height: number }
  ): Promise<void> {
    let result: Awaited<ReturnType<typeof clearBackgroundAt>>;
    try {
      result = await this.clearBackground(pending.original.file, point, size);
    } catch {
      result = { kind: 'failed' };
    } finally {
      this.clearingColor.set(false);
    }
    // The picture may have been added or dropped while the copy was being made. A panel closed
    // meanwhile still takes the copy, since it is what gets added as the panel goes.
    if (this.pendingImage() !== pending) return;
    if (result.kind === 'missed') {
      this.pendingNotice.set('pickMissed');
      return;
    }
    if (result.kind === 'failed') {
      this.pendingNotice.set('clearFailed');
      this.pickingColor.set(false);
      return;
    }
    if (pending.transparent) URL.revokeObjectURL(pending.transparent.url);
    this.pendingImage.set({
      ...pending,
      transparent: { file: result.file, url: URL.createObjectURL(result.file), color: result.color },
    });
    this.pendingNotice.set(null);
    this.pickingColor.set(false);
  }

  /** Goes back to the original picture, dropping the transparent copy. */
  undoTransparent(): void {
    const pending = this.pendingImage();
    if (!pending?.transparent || this.clearingColor()) return;
    URL.revokeObjectURL(pending.transparent.url);
    this.pendingImage.set({ ...pending, transparent: null });
    this.pickingColor.set(false);
  }

  /** The colour cleared from the held picture, as CSS, for the swatch beside the preview. */
  protected swatch(color: PickedColor): string {
    return `rgb(${color.r} ${color.g} ${color.b})`;
  }

  /**
   * Takes what a paste, clipboard reading, choice or drop brought, after anything that arrived
   * before it. Whatever is started here without waiting on anything happens before this returns.
   */
  private offer(result: ClipboardImageResult, place: ImageDropPlace | null = null, returned = false): Promise<void> {
    const arrival = result.kind === 'image' ? { file: result.file, place } : null;
    if (arrival) this.arrivals.push(arrival);
    const receive = () => this.receive(result, arrival, returned);
    const received = this.intake ? this.intake.then(receive, receive) : receive();
    this.intake = received;
    const settle = () => {
      if (this.intake === received) this.intake = null;
    };
    void received.then(settle, settle);
    return received;
  }

  /**
   * Holds a new picture for confirmation. One already held is added to the room first, with its
   * transparent copy if one was made, so taking in the next picture never throws it away; only
   * cancelling does. If it cannot be added it stays held and the new picture is not taken.
   * Something that is not a picture leaves the held one where it is.
   *
   * A picture still to be taken when the panel closes stays among the arrivals, to be added then.
   */
  private async receive(
    result: ClipboardImageResult,
    arrival: UnconfirmedImage | null,
    returned: boolean
  ): Promise<void> {
    if (this.destroyed) return;
    if (result.kind !== 'image') {
      this.pendingNotice.set(result.kind);
      return;
    }
    if (!arrival) return;
    // The copy being made is what gets added, and a picture already being added is not added twice.
    while (this.adding || this.clearing) await (this.adding ?? this.clearing);
    if (this.destroyed) return;
    const held = this.pendingImage();
    let previous: PendingNotice | null = null;
    if (held) {
      previous = await this.add(held);
      if (this.destroyed) return;
      if (previous === 'oversized' || previous === 'failed' || previous === 'noPermission') {
        this.letGoOf(arrival);
        this.pendingNotice.set(
          previous === 'oversized' ? 'keptOversized' : previous === 'failed' ? 'keptFailed' : 'keptNoPermission'
        );
        return;
      }
    }
    this.letGoOf(arrival);
    this.hold(arrival.file, arrival.place);
    if (returned) this.pendingNotice.set('returned');
    else if (previous === 'added') this.pendingNotice.set('previousAdded');
    else if (previous === 'duplicate') this.pendingNotice.set('previousDuplicate');
  }

  private letGoOf(arrival: UnconfirmedImage): void {
    const index = this.arrivals.indexOf(arrival);
    if (index >= 0) this.arrivals.splice(index, 1);
  }

  /**
   * Hands whatever is left unconfirmed as the panel closes to be added, once anything under way
   * has finished, so that nothing is added twice. Only cancelling throws a picture away.
   */
  private async handOverUnconfirmed(): Promise<void> {
    while (this.intake || this.adding || this.clearing) {
      try {
        await (this.intake ?? this.adding ?? this.clearing);
      } catch {
        // Whatever went wrong is left to show in what remains held.
      }
    }
    const pending = this.pendingImage();
    const left: UnconfirmedImage[] = pending
      ? [{ file: (pending.transparent ?? pending.original).file, place: pending.place }]
      : [];
    left.push(...this.arrivals.splice(0));
    this.dropPendingImage();
    if (left.length) await this.droppedImages.addUnconfirmed(left);
  }

  /**
   * Stores a held picture, letting go of it once stored. One that could not be stored, or that
   * this seat no longer has leave to add, is kept.
   */
  private add(pending: PendingImage): Promise<PendingNotice> {
    if (!this.rolePermission.canEditTabletop) return Promise.resolve('noPermission');
    this.pendingAdding.set(true);
    this.pickingColor.set(false);
    const adding = this.store(pending).then((notice) => {
      this.adding = null;
      this.pendingAdding.set(false);
      if (notice !== 'oversized' && notice !== 'failed' && this.pendingImage() === pending) this.dropPendingImage();
      return notice;
    });
    this.adding = adding;
    return adding;
  }

  private async store(pending: PendingImage): Promise<PendingNotice> {
    const stored = new Set(this.imageStorage.images.map((image) => image.identifier));
    try {
      const file = (pending.transparent ?? pending.original).file;
      // A dropped picture is placed where it was dropped, as it would have been without asking.
      const { images, oversized } = pending.place
        ? await this.fileArchiver.loadImages([file], pending.place)
        : await this.fileArchiver.loadImages([file]);
      if (oversized.length) return 'oversized';
      if (!images.length) return 'failed';
      return stored.has(images[0].identifier) ? 'duplicate' : 'added';
    } catch {
      return 'failed';
    }
  }

  private hold(file: File, place: ImageDropPlace | null): void {
    const pending: PendingImage = {
      original: { file, url: URL.createObjectURL(file) },
      transparent: null,
      place,
    };
    this.pendingImage.set(pending);
    this.canClearPending.set(false);
    this.pickingColor.set(false);
    this.pendingNotice.set(null);
    this.canClear(file).then(
      (can) => this.pendingImage() === pending && this.canClearPending.set(can),
      () => this.pendingImage() === pending && this.canClearPending.set(false)
    );
  }

  private dropPendingImage(): void {
    const pending = this.pendingImage();
    if (pending) {
      URL.revokeObjectURL(pending.original.url);
      if (pending.transparent) URL.revokeObjectURL(pending.transparent.url);
    }
    this.pendingImage.set(null);
    this.canClearPending.set(false);
    this.pickingColor.set(false);
  }

  /** Selects a picture and announces it as the chosen file to anything waiting for one. */
  onSelectedFile(file: ImageFile) {
    emitSelectFile({ fileIdentifier: file.identifier });

    this.selectedFile = file;
  }

  /** Ticks or unticks a picture for the bulk tag and keep-back actions. */
  imgBlockClick(identifier: string) {
    if (this.checkedFiles.has(identifier)) {
      this.checkedFiles.delete(identifier);
    } else {
      this.checkedFiles.add(identifier);
    }
  }
}
