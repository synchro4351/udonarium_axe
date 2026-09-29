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
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { PanelService } from '@axe/application/ui/panel.service';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { characterPortraitChoices, currentPortraitImageIdentifier } from '@axe/domain/character/character-portrait';
import { clearPortraitFitOf, portraitFitOf, setPortraitFitOf } from '@axe/domain/character/character-portrait-fit';
import { GameCharacter } from '@axe/domain/character/game-character';
import {
  CUT_IN_PORTRAIT_FRAME_SHAPES,
  type CutInPortraitFit,
  type CutInPortraitFrame,
  DEFAULT_CUT_IN_PORTRAIT_FIT,
  DEFAULT_PORTRAIT_FRAME,
  MAX_PORTRAIT_ZOOM,
  MIN_PORTRAIT_ZOOM,
  normalizePortraitFit,
  panPortraitFit,
  portraitFitCss,
  zoomPortraitFit,
} from '@axe/domain/media/cut-in-portrait';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

/** How much one notch of the wheel, or one press of a size button, sizes the picture. */
const ZOOM_STEP = 1.08;

interface Point {
  x: number;
  y: number;
}

/** A gesture on the frame: one finger or the mouse pans, two fingers pinch to size. */
type Gesture =
  | { kind: 'pan'; from: CutInPortraitFit; start: Point; slot: { width: number; height: number } }
  | { kind: 'pinch'; from: CutInPortraitFit; distance: number };

/**
 * Lining a character's pictures up with a cut-in's portrait frame, from the character's sheet.
 *
 * The picture is shown in the frame the way a cut-in's portrait slot draws it, under the outline of
 * the frame. Dragging it, the wheel, a pinch, the slider or the size buttons change the fit, which
 * is kept on the character for that picture and frame, so every cut-in whose slot uses the frame
 * shows it the same way. A gesture shows its result as it goes and is written once it ends, so the
 * room receives one change rather than one per pointer move.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'character-portrait-fit',
  templateUrl: './character-portrait-fit.component.html',
  host: { class: 'block' },
  imports: [SafePipe, TranslocoModule],
})
export class CharacterPortraitFitComponent {
  private readonly objectChange = inject(ObjectChangeService);
  private readonly imageStorage = inject(ImageStorage);
  private readonly rolePermission = inject(RolePermissionService);
  private readonly panelService = inject(PanelService);

  private readonly frameArea = viewChild<ElementRef<HTMLElement>>('frameArea');

  /** The character whose pictures are fitted. */
  readonly character = signal<GameCharacter | null>(null);
  readonly frame: CutInPortraitFrame = DEFAULT_PORTRAIT_FRAME;
  protected readonly shape = CUT_IN_PORTRAIT_FRAME_SHAPES[DEFAULT_PORTRAIT_FRAME];
  protected readonly minZoom = MIN_PORTRAIT_ZOOM;
  protected readonly maxZoom = MAX_PORTRAIT_ZOOM;

  private readonly chosenImage = signal('');
  /** The fit a gesture has got to, shown before it is written. */
  private readonly draft = signal<CutInPortraitFit | null>(null);
  private readonly pointers = new Map<number, Point>();
  private gesture: Gesture | null = null;

  /** Whether this user may change the character, as the rest of its sheet is judged. */
  readonly canEdit = computed(() => {
    this.objectChange.trackMyCursor();
    return this.rolePermission.canEditTabletop;
  });

  readonly choices = computed(() => {
    this.objectChange.fileVersion();
    const character = this.watchedCharacter();
    if (!character) return [];
    return characterPortraitChoices(character).map((choice) => ({
      ...choice,
      url: this.imageStorage.get(choice.imageIdentifier)?.url ?? '',
    }));
  });

  /** The picture being fitted: the one chosen here, else the one the character speaks with, else the first. */
  readonly imageIdentifier = computed(() => {
    const choices = this.choices();
    const chosen = this.chosenImage();
    if (choices.some((choice) => choice.imageIdentifier === chosen)) return chosen;
    const character = this.character();
    const speaking = character ? currentPortraitImageIdentifier(character) : '';
    if (choices.some((choice) => choice.imageIdentifier === speaking)) return speaking;
    return choices[0]?.imageIdentifier ?? '';
  });

  readonly imageUrl = computed(
    () => this.choices().find((choice) => choice.imageIdentifier === this.imageIdentifier())?.url ?? ''
  );

  /** The fit the character keeps for the picture, or none while it has never been fitted. */
  readonly savedFit = computed(() => {
    const character = this.watchedCharacter();
    const image = this.imageIdentifier();
    return character && image ? portraitFitOf(character, this.frame, image) : null;
  });

  readonly fit = computed<CutInPortraitFit>(
    () => this.draft() ?? this.savedFit() ?? { ...DEFAULT_CUT_IN_PORTRAIT_FIT }
  );
  readonly fitCss = computed(() => portraitFitCss(this.fit()));
  /** The position as the number fields show it, to a tenth of a percent. */
  protected readonly shownAt = computed(() => ({
    x: Math.round(this.fit().x * 10) / 10,
    y: Math.round(this.fit().y * 10) / 10,
  }));

  constructor() {
    this.objectChange.objectDeleted$.subscribe((event) => {
      if (event.identifier === this.character()?.identifier) this.panelService.close();
    }, inject(DestroyRef));
  }

  /** Picks which picture to fit, as a thumbnail does. */
  selectImage(imageIdentifier: string): void {
    this.endGesture();
    this.chosenImage.set(imageIdentifier);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.canEdit() || !this.imageIdentifier()) return;
    event.preventDefault();
    (event.target as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.beginGesture();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = this.gesture;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      const distance = this.pinchDistance();
      if (distance > 0 && gesture.distance > 0) {
        const zoom = Math.round(gesture.from.zoom * (distance / gesture.distance) * 100) / 100;
        this.draft.set(normalizePortraitFit({ ...gesture.from, zoom }));
      }
      return;
    }
    const at = this.pointers.values().next().value as Point;
    this.draft.set(panPortraitFit(gesture.from, at.x - gesture.start.x, at.y - gesture.start.y, gesture.slot));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    (event.target as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    this.pointers.delete(event.pointerId);
    // A finger lifted from a pinch leaves the other one panning from where the pinch got to.
    if (this.pointers.size > 0) this.beginGesture();
    else this.endGesture();
  }

  protected onWheel(event: WheelEvent): void {
    if (!this.canEdit() || !this.imageIdentifier()) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  }

  protected zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /** The slider shows the size as it moves and writes it once let go. */
  protected onZoomInput(event: Event): void {
    const zoom = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(zoom)) this.draft.set(normalizePortraitFit({ ...this.freshFit(), zoom }));
  }

  protected onZoomChange(event: Event): void {
    const zoom = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(zoom)) this.write({ ...this.freshFit(), zoom });
  }

  protected onAxisChange(axis: 'x' | 'y', event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (Number.isFinite(value)) this.write({ ...this.freshFit(), [axis]: value });
  }

  /** Puts the picture back the way an unfitted one sits. */
  reset(): void {
    const character = this.character();
    const image = this.imageIdentifier();
    this.draft.set(null);
    if (!character || !image || !this.canEdit()) return;
    clearPortraitFitOf(character, this.frame, image);
  }

  private zoomBy(factor: number): void {
    this.write(zoomPortraitFit(this.freshFit(), factor));
  }

  /**
   * The fit as it stands this moment, for a change to start from. The character is read directly,
   * since what it hears of its own last write reaches `fit` only once the change has gone round.
   */
  private freshFit(): CutInPortraitFit {
    const character = this.character();
    const image = this.imageIdentifier();
    const saved = character && image ? portraitFitOf(character, this.frame, image) : null;
    return this.draft() ?? saved ?? { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  }

  private write(fit: CutInPortraitFit): void {
    this.draft.set(null);
    const character = this.character();
    const image = this.imageIdentifier();
    if (!character || !image || !this.canEdit()) return;
    setPortraitFitOf(character, this.frame, image, fit);
  }

  private beginGesture(): void {
    const from = this.freshFit();
    if (this.pointers.size >= 2) {
      this.gesture = { kind: 'pinch', from, distance: this.pinchDistance() };
      return;
    }
    const start = this.pointers.values().next().value as Point;
    const bounds = this.frameArea()?.nativeElement.getBoundingClientRect();
    this.gesture = {
      kind: 'pan',
      from,
      start,
      slot: { width: bounds?.width ?? 0, height: bounds?.height ?? 0 },
    };
  }

  /** Writes what a gesture got to, once, and lets go of it. */
  private endGesture(): void {
    this.pointers.clear();
    const wasGesturing = this.gesture !== null;
    this.gesture = null;
    const draft = this.draft();
    if (wasGesturing && draft) this.write(draft);
    else this.draft.set(null);
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private watchedCharacter(): GameCharacter | null {
    const character = this.character();
    if (character) this.objectChange.versionOf(character.identifier)();
    return character;
  }
}
