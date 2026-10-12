import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  IMAGE_PART_HANDLES,
  ImagePart,
  imagePartBetween,
  ImagePartHandle,
  imagePartHandleAnchor,
  ImagePoint,
  imagePointAt,
  MAX_IMAGE_PARTS,
  MIN_IMAGE_PART_SIZE,
  moveImagePart,
  resizeImagePart,
  topmostImagePartAt,
} from '@axe/domain/character/image-part';
import { MIN_LINKED_PARTS } from '@axe/domain/character/part-group';
import { loadPartImage } from '@axe/infrastructure/media/image-part-crop';
import { TranslocoModule } from '@jsverse/transloco';

/** How far a press has to travel, in screen pixels, before it is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

const HANDLE_CURSORS: Record<ImagePartHandle, string> = {
  n: 'cursor-ns-resize',
  s: 'cursor-ns-resize',
  e: 'cursor-ew-resize',
  w: 'cursor-ew-resize',
  ne: 'cursor-nesw-resize',
  sw: 'cursor-nesw-resize',
  nw: 'cursor-nwse-resize',
  se: 'cursor-nwse-resize',
};

@Component({
  selector: 'multipart-character',
  templateUrl: './multipart-character.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoModule],
  host: { class: 'block p-3' },
})
export class MultipartCharacterComponent {
  private readonly service = inject(MultipartCharacterService);
  private readonly images = inject(ImageStorage);
  private readonly changes = inject(ObjectChangeService);
  private readonly panel = inject(PanelService);
  private readonly t = inject(TRANSLATE_FN);
  private identifier = '';
  private alive = true;
  private image: HTMLImageElement | null = null;
  private start: ImagePoint | null = null;
  private pointer: number | null = null;
  /** What the current pointer gesture does: draw a new region, or move or resize the selected one. */
  private gesture: 'draw' | 'move' | 'resize' | null = null;
  /** The element the pointer is measured against; handles sit over it but are not it. */
  private frame: { getBoundingClientRect(): { left: number; top: number; width: number; height: number } } | null =
    null;
  private origin: ImagePart | null = null;
  private handle: ImagePartHandle | null = null;
  private pressed: { x: number; y: number } = { x: 0, y: 0 };
  private dragged = false;
  /** The region under a press that began a draw, selected if the press turns out to be a plain click. */
  private clicked = -1;
  readonly url = signal('');
  readonly width = signal(0);
  readonly height = signal(0);
  readonly parts = signal<ImagePart[]>([]);
  readonly draft = signal<ImagePart | null>(null);
  /** Index of the region that can be moved and resized; null for none. */
  readonly selected = signal<number | null>(null);
  readonly selectedPart = computed(() => this.parts()[this.selected() ?? -1] ?? null);
  readonly handles = IMAGE_PART_HANDLES;
  readonly handleCursor = HANDLE_CURSORS;
  readonly busy = signal(false);
  readonly error = signal('');
  readonly limit = MAX_IMAGE_PARTS;
  /** The character being split into linked parts; null when cutting independent tokens from an image. */
  readonly character = signal<GameCharacter | null>(null);
  readonly groupName = signal('');
  readonly minimum = computed(() => (this.character() ? MIN_LINKED_PARTS : 1));

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.alive = false;
    });
  }

  async initialize(identifier: string): Promise<void> {
    this.identifier = identifier;
    this.busy.set(true);
    try {
      if (!this.mayEdit()) throw new Error('Unavailable');
      const url = this.images.get(identifier)!.url;
      const image = await loadPartImage(url);
      if (!this.alive) return;
      if (!this.mayEdit()) throw new Error('Unavailable');
      this.image = image;
      this.width.set(image.naturalWidth);
      this.height.set(image.naturalHeight);
      this.url.set(url);
    } catch {
      this.error.set('feature.file.multipart.unavailable');
    } finally {
      this.busy.set(false);
    }
  }

  /** Opens on the picture a character is showing, to split it into linked parts. */
  initializeForCharacter(character: GameCharacter): Promise<void> {
    this.character.set(character);
    this.groupName.set(character.name);
    return this.initialize(character.imageFile.identifier);
  }

  private mayEdit(): boolean {
    const character = this.character();
    return character ? this.service.mayLink(character) : this.service.mayUse(this.identifier);
  }

  get canEdit(): boolean {
    this.changes.fileVersion();
    this.changes.collectionOf('image-tag')();
    this.changes.versionOf(`imagetag_${this.identifier}`)();
    this.changes.collectionOf('peer-cursor')();
    const character = this.character();
    if (character) this.changes.versionOf(character.identifier)();
    return !!this.image && this.mayEdit();
  }

  get canCreate(): boolean {
    const named = !this.character() || this.groupName().trim().length > 0;
    return !this.busy() && this.canEdit && named && this.parts().length >= this.minimum();
  }

  private point(event: PointerEvent): ImagePoint {
    return imagePointAt(
      { x: event.clientX, y: event.clientY },
      this.frame!.getBoundingClientRect(),
      this.width(),
      this.height()
    );
  }

  /** Where a handle sits on the selected region, as percentages of the picture. */
  handleStyle(part: ImagePart, handle: ImagePartHandle): Record<string, string> {
    const { fx, fy } = imagePartHandleAnchor(handle);
    return {
      left: `${((part.x + part.width * fx) / this.width()) * 100}%`,
      top: `${((part.y + part.height * fy) / this.height()) * 100}%`,
    };
  }

  select(index: number | null): void {
    this.selected.set(index);
  }

  pointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.pointer !== null || !this.canEdit || this.busy()) return;
    this.frame = event.currentTarget as SVGSVGElement;
    const start = this.point(event);
    const hit = topmostImagePartAt(start, this.parts());
    event.preventDefault();
    event.stopPropagation();
    this.error.set('');
    this.pointer = event.pointerId;
    this.start = start;
    this.pressed = { x: event.clientX, y: event.clientY };
    this.dragged = false;
    // Only the selected region moves; a press on any other starts a new one, or selects it if it was a click.
    this.gesture = hit >= 0 && hit === this.selected() ? 'move' : 'draw';
    this.origin = this.gesture === 'move' ? this.parts()[hit] : null;
    this.clicked = hit;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  }

  /** Starts resizing the selected region from one of its handles. */
  handleDown(event: PointerEvent, handle: ImagePartHandle): void {
    const selected = this.selected();
    if (event.button !== 0 || this.pointer !== null || selected === null || !this.canEdit || this.busy()) return;
    const target = event.currentTarget as Element;
    this.frame = target.closest('[data-multipart-frame]') ?? target.parentElement;
    if (!this.frame) return;
    event.preventDefault();
    event.stopPropagation();
    this.error.set('');
    this.pointer = event.pointerId;
    this.start = this.point(event);
    this.pressed = { x: event.clientX, y: event.clientY };
    this.dragged = false;
    this.gesture = 'resize';
    this.handle = handle;
    this.origin = this.parts()[selected];
    this.clicked = -1;
    target.setPointerCapture(event.pointerId);
  }

  pointerMove(event: PointerEvent): void {
    if (this.pointer !== event.pointerId || !this.start || !this.frame) return;
    event.stopPropagation();
    if (!this.dragged) {
      // A touch easily slips a pixel or two; that is still a tap.
      this.dragged = Math.hypot(event.clientX - this.pressed.x, event.clientY - this.pressed.y) >= DRAG_THRESHOLD_PX;
      if (!this.dragged) return;
    }
    const point = this.point(event);
    if (this.gesture === 'draw') this.draft.set(imagePartBetween(this.start, point, ''));
    else this.adjustSelected(point);
  }

  pointerUp(event: PointerEvent): void {
    if (this.pointer !== event.pointerId || !this.start || !this.frame) return;
    event.stopPropagation();
    const gesture = this.gesture;
    const point = this.point(event);
    const part = imagePartBetween(
      this.start,
      point,
      this.t('feature.file.multipart.part', { number: this.parts().length + 1 })
    );
    const dragged = this.dragged;
    const clicked = this.clicked;
    if (gesture !== 'draw' && dragged) this.adjustSelected(point);
    this.finishPointer();
    if (gesture !== 'draw') return;
    if (!dragged) {
      this.selected.set(clicked >= 0 ? clicked : null);
      return;
    }
    if (
      !this.canEdit ||
      this.busy() ||
      this.parts().length >= this.limit ||
      part.width < MIN_IMAGE_PART_SIZE ||
      part.height < MIN_IMAGE_PART_SIZE
    )
      return;
    this.parts.update((parts) => [...parts, part]);
    this.selected.set(this.parts().length - 1);
  }

  /** Abandons the gesture; a move or resize that was under way goes back to where it started. */
  cancelPointer(): void {
    const selected = this.selected();
    if (this.gesture !== 'draw' && this.origin && selected !== null) this.replaceSelected(this.origin);
    this.finishPointer();
  }

  private adjustSelected(point: ImagePoint): void {
    const origin = this.origin;
    if (!origin || !this.start) return;
    const next =
      this.gesture === 'resize' && this.handle
        ? resizeImagePart(origin, this.handle, point, this.width(), this.height())
        : moveImagePart(origin, point.x - this.start.x, point.y - this.start.y, this.width(), this.height());
    this.replaceSelected(next);
  }

  private replaceSelected(part: ImagePart): void {
    const selected = this.selected();
    if (selected === null) return;
    this.parts.update((parts) => parts.map((current, i) => (i === selected ? part : current)));
  }

  private finishPointer(): void {
    this.pointer = null;
    this.start = null;
    this.gesture = null;
    this.origin = null;
    this.handle = null;
    this.dragged = false;
    this.clicked = -1;
    this.draft.set(null);
  }

  rename(index: number, name: string): void {
    if (this.busy() || !this.canEdit) return;
    this.parts.update((parts) => parts.map((part, i) => (i === index ? { ...part, name } : part)));
  }

  remove(index: number): void {
    if (this.busy() || !this.canEdit) return;
    this.parts.update((parts) => parts.filter((_, i) => i !== index));
    this.selected.update((selected) =>
      selected === null || selected === index ? null : selected > index ? selected - 1 : selected
    );
  }

  clear(): void {
    if (this.busy() || !this.canEdit) return;
    this.parts.set([]);
    this.selected.set(null);
  }
  close(): void {
    this.alive = false;
    this.panel.close();
  }

  async create(): Promise<void> {
    if (!this.canCreate || !this.image) return;
    this.busy.set(true);
    this.error.set('');
    const stillOpen = () => this.alive && this.images.get(this.identifier)?.url === this.url();
    const character = this.character();
    try {
      if (character) {
        await this.service.createLinked(character, this.image, this.parts(), this.groupName(), stillOpen);
      } else {
        await this.service.create(this.identifier, this.image, this.parts(), stillOpen);
      }
      if (this.alive) this.close();
    } catch (error) {
      if (this.alive)
        this.error.set(
          error instanceof Error && error.message === 'Oversized'
            ? 'feature.file.multipart.oversized'
            : 'feature.file.multipart.failed'
        );
    } finally {
      this.busy.set(false);
    }
  }
}
