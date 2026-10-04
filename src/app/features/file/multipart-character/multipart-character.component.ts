import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { MultipartCharacterService } from '@axe/application/tabletop/multipart-character.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  ImagePart,
  imagePartBetween,
  ImagePoint,
  imagePointAt,
  imagePointInsideAnyPart,
  MAX_IMAGE_PARTS,
  overlapsAnyImagePart,
} from '@axe/domain/character/image-part';
import { MIN_LINKED_PARTS } from '@axe/domain/character/part-group';
import { loadPartImage } from '@axe/infrastructure/media/image-part-crop';
import { TranslocoModule } from '@jsverse/transloco';

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
  readonly url = signal('');
  readonly width = signal(0);
  readonly height = signal(0);
  readonly parts = signal<ImagePart[]>([]);
  readonly draft = signal<ImagePart | null>(null);
  readonly draftBlocked = computed(() => {
    const draft = this.draft();
    return !!draft && overlapsAnyImagePart(draft, this.parts());
  });
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
      (event.currentTarget as SVGSVGElement).getBoundingClientRect(),
      this.width(),
      this.height()
    );
  }

  pointerDown(event: PointerEvent): void {
    if (
      event.button !== 0 ||
      this.pointer !== null ||
      !this.canEdit ||
      this.busy() ||
      this.parts().length >= this.limit
    )
      return;
    const start = this.point(event);
    if (imagePointInsideAnyPart(start, this.parts())) return;
    event.preventDefault();
    event.stopPropagation();
    this.error.set('');
    this.pointer = event.pointerId;
    this.start = start;
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
  }

  pointerMove(event: PointerEvent): void {
    if (this.pointer !== event.pointerId || !this.start) return;
    event.stopPropagation();
    this.draft.set(imagePartBetween(this.start, this.point(event), ''));
  }

  pointerUp(event: PointerEvent): void {
    if (this.pointer !== event.pointerId || !this.start) return;
    event.stopPropagation();
    const part = imagePartBetween(
      this.start,
      this.point(event),
      this.t('feature.file.multipart.part', { number: this.parts().length + 1 })
    );
    this.cancelPointer();
    if (!this.canEdit || this.busy() || part.width < 2 || part.height < 2) return;
    if (overlapsAnyImagePart(part, this.parts())) {
      this.error.set('feature.file.multipart.overlap');
      return;
    }
    this.parts.update((parts) => [...parts, part]);
  }

  cancelPointer(): void {
    this.pointer = null;
    this.start = null;
    this.draft.set(null);
  }

  rename(index: number, name: string): void {
    if (this.busy() || !this.canEdit) return;
    this.parts.update((parts) => parts.map((part, i) => (i === index ? { ...part, name } : part)));
  }

  remove(index: number): void {
    if (!this.busy() && this.canEdit) this.parts.update((parts) => parts.filter((_, i) => i !== index));
  }

  clear(): void {
    if (!this.busy() && this.canEdit) this.parts.set([]);
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
