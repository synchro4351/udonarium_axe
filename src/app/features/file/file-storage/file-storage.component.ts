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
import { PanelService } from '@axe/application/ui/panel.service';
import { ViewportService } from '@axe/application/ui/viewport.service';
import { emitSelectFile } from '@axe/core/event/domain-events';
import { FileArchiver } from '@axe/core/storage/file-archiver';
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
  canClearBackground,
  clearBackgroundAt,
  PickedColor,
} from '@axe/features/file/file-storage/transparent-background';
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
  | 'clearFailed';

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
};

/** A picture held for the user to look over, with the object URL its preview is shown from. */
interface HeldFile {
  readonly file: File;
  readonly url: string;
}

/** A picture waiting for the user to add it, and the transparent copy made of it, if any. */
export interface PendingImage {
  readonly original: HeldFile;
  readonly transparent: (HeldFile & { readonly color: PickedColor }) | null;
}

@Component({
  selector: 'file-storage',
  templateUrl: './file-storage.component.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SafePipe, TranslocoModule],
})
export class FileStorageComponent {
  protected readonly isCompact = inject(ViewportService).isCompact;
  private readonly panelService = inject(PanelService);
  private readonly imageStorage = inject(ImageStorage);
  private readonly fileArchiver = inject(FileArchiver);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly rolePermission = inject(RolePermissionService);
  private readonly t = inject(TRANSLATE_FN);

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
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.dropPendingImage();
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
    if (files?.length === 1 && isPasteableImage(files[0].type) && !this.pendingAdding()) {
      this.holdResult({ kind: 'image', file: files[0] });
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
      this.holdResult({ kind: 'noPermission' });
      return;
    }
    this.holdResult(imageFromPaste(event.clipboardData));
  }

  /** Reads a picture from the clipboard on request, holding it for confirmation. */
  async readFromClipboard(): Promise<void> {
    if (!this.rolePermission.canEditTabletop) {
      this.holdResult({ kind: 'noPermission' });
      return;
    }
    const result = await readClipboardImage(navigator.clipboard);
    if (!this.destroyed) this.holdResult(result);
  }

  /**
   * Stores the held picture, or its transparent copy when one was made, the same way the upload
   * dialog does, so the usual size limit applies and the room is told of it like any other picture.
   * A picture already stored is reported as a duplicate.
   */
  async confirmPending(): Promise<void> {
    const pending = this.pendingImage();
    if (!pending || this.pendingAdding() || this.clearingColor()) return;
    if (!this.rolePermission.canEditTabletop) {
      this.dropPendingImage();
      this.pendingNotice.set('noPermission');
      return;
    }
    this.pendingAdding.set(true);
    this.pickingColor.set(false);
    const stored = new Set(this.imageStorage.images.map((image) => image.identifier));
    let notice: PendingNotice;
    try {
      const file = (pending.transparent ?? pending.original).file;
      const { images, oversized } = await this.fileArchiver.loadImages([file]);
      if (oversized.length) notice = 'oversized';
      else if (!images.length) notice = 'failed';
      else notice = stored.has(images[0].identifier) ? 'duplicate' : 'added';
    } catch {
      notice = 'failed';
    }
    this.pendingAdding.set(false);
    this.dropPendingImage();
    this.pendingNotice.set(notice);
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
    const result = await this.clearBackground(
      pending.original.file,
      { x: event.offsetX, y: event.offsetY },
      { width: preview.clientWidth, height: preview.clientHeight }
    );
    this.clearingColor.set(false);
    // The picture may have been added or dropped while the copy was being made.
    if (this.destroyed || this.pendingImage() !== pending) return;
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
      original: pending.original,
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
    this.pendingImage.set({ original: pending.original, transparent: null });
    this.pickingColor.set(false);
  }

  /** The colour cleared from the held picture, as CSS, for the swatch beside the preview. */
  protected swatch(color: PickedColor): string {
    return `rgb(${color.r} ${color.g} ${color.b})`;
  }

  private holdResult(result: ClipboardImageResult | { kind: 'noPermission' }): void {
    // A picture still being stored is not pushed aside by the next one.
    if (this.pendingAdding()) return;
    this.dropPendingImage();
    if (result.kind !== 'image') {
      this.pendingNotice.set(result.kind);
      return;
    }
    const pending: PendingImage = {
      original: { file: result.file, url: URL.createObjectURL(result.file) },
      transparent: null,
    };
    this.pendingImage.set(pending);
    this.pendingNotice.set(null);
    this.canClear(result.file).then(
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
