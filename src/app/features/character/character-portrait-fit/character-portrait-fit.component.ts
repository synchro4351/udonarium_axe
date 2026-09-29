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
  currentPortraitFit,
  CUT_IN_PORTRAIT_FRAME_SHAPES,
  type CutInPortraitFit,
  type CutInPortraitFrame,
  DEFAULT_CUT_IN_PORTRAIT_FIT,
  DEFAULT_PORTRAIT_FRAME,
  MAX_PORTRAIT_SCALE,
  MIN_PORTRAIT_SCALE,
  panPortraitFit,
  PORTRAIT_FRAME_HEIGHT,
  PORTRAIT_FRAME_WIDTH,
  portraitFitCss,
  zoomPortraitFit,
} from '@axe/domain/media/cut-in-portrait';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';
import { TranslocoModule } from '@jsverse/transloco';

/** How much one press of a size button or key sizes the picture. */
const ZOOM_STEP = 1.1;
/** How far one press of an arrow key moves the picture, in frame pixels. */
const NUDGE = 4;
/** How long the wheel has to rest before what it did is written, so a spin sends one change. */
const WHEEL_SETTLE_MS = 300;

interface Point {
  x: number;
  y: number;
}

/**
 * A gesture on the frame: one finger or the mouse moves the picture, two fingers size it around
 * where they are and move it as they move. Points are in frame pixels from the frame's centre.
 */
type Gesture =
  | { kind: 'pan'; from: CutInPortraitFit; start: Point }
  | { kind: 'pinch'; from: CutInPortraitFit; centre: Point; distance: number };

/**
 * Lining a character's pictures up with a cut-in's portrait frame, from the character's sheet.
 *
 * The picture is shown whole, with what falls outside the frame dimmed, so it can be dragged well
 * past the frame's edges and still be seen and caught. The fit is kept on the character for that
 * picture and frame, so every cut-in whose slot uses the frame shows it the same way. A gesture
 * shows its result as it goes and is written once it ends, so the room receives one change rather
 * than one per pointer move.
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

  private readonly frameBox = viewChild<ElementRef<HTMLElement>>('frameBox');

  /** The character whose pictures are fitted. */
  readonly character = signal<GameCharacter | null>(null);
  readonly frame: CutInPortraitFrame = DEFAULT_PORTRAIT_FRAME;
  protected readonly shape = CUT_IN_PORTRAIT_FRAME_SHAPES[DEFAULT_PORTRAIT_FRAME];
  protected readonly minScale = MIN_PORTRAIT_SCALE;
  protected readonly maxScale = MAX_PORTRAIT_SCALE;

  private readonly chosenImage = signal('');
  /** The proportions of the picture as it loaded, which an older fit needs to be shown. */
  private readonly loaded = signal<{ url: string; aspect: number } | null>(null);
  /** The fit a gesture has got to, shown before it is written. */
  private readonly draft = signal<CutInPortraitFit | null>(null);
  private readonly pointers = new Map<number, Point>();
  private gesture: Gesture | null = null;
  protected readonly grabbing = signal(false);
  private wheelTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Width over height of the picture, taken as the frame's own until it has loaded. */
  private readonly imageAspect = computed(() => {
    const loaded = this.loaded();
    return loaded && loaded.url === this.imageUrl() ? loaded.aspect : PORTRAIT_FRAME_WIDTH / PORTRAIT_FRAME_HEIGHT;
  });

  /** The fit the character keeps for the picture, or none while it has never been fitted. */
  readonly savedFit = computed(() => {
    const character = this.watchedCharacter();
    const image = this.imageIdentifier();
    return character && image ? portraitFitOf(character, this.frame, image) : null;
  });

  /** The fit as shown, with one kept the old way turned into the current shape. */
  readonly fit = computed<CutInPortraitFit>(() => {
    const draft = this.draft();
    if (draft) return draft;
    const saved = this.savedFit();
    return saved ? currentPortraitFit(saved, this.imageAspect()) : { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
  });
  readonly fitCss = computed(() => portraitFitCss(this.fit()));
  protected readonly scalePercent = computed(() => Math.round(this.fit().scale * 100));

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.objectChange.objectDeleted$.subscribe((event) => {
      if (event.identifier === this.character()?.identifier) this.panelService.close();
    }, destroyRef);
    destroyRef.onDestroy(() => this.flushWheel());
  }

  /** Picks which picture to fit, as a thumbnail does. */
  selectImage(imageIdentifier: string): void {
    this.flushWheel();
    this.endGesture();
    this.chosenImage.set(imageIdentifier);
  }

  protected onImageLoad(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image || !(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return;
    this.loaded.set({ url: this.imageUrl(), aspect: image.naturalWidth / image.naturalHeight });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (!this.canEdit() || !this.imageIdentifier()) return;
    event.preventDefault();
    this.flushWheel();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, this.framePoint(event));
    this.beginGesture();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, this.framePoint(event));
    const gesture = this.gesture;
    if (!gesture) return;

    if (gesture.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b || gesture.distance <= 0) return;
      const centre = midpoint(a, b);
      const sized = zoomPortraitFit(gesture.from, distance(a, b) / gesture.distance, gesture.centre);
      this.draft.set(panPortraitFit(sized, centre.x - gesture.centre.x, centre.y - gesture.centre.y));
      return;
    }
    const at = this.pointers.values().next().value as Point;
    this.draft.set(panPortraitFit(gesture.from, at.x - gesture.start.x, at.y - gesture.start.y));
  }

  protected onPointerUp(event: PointerEvent): void {
    if (!this.pointers.has(event.pointerId)) return;
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    this.pointers.delete(event.pointerId);
    // A finger lifted from a pinch leaves the other one moving from where the pinch got to.
    if (this.pointers.size > 0) this.beginGesture();
    else this.endGesture();
  }

  /** The wheel, and a trackpad's pinch, size the picture around the pointer. */
  protected onWheel(event: WheelEvent): void {
    if (!this.canEdit() || !this.imageIdentifier()) return;
    event.preventDefault();
    const lines = event.deltaMode === 1 ? 33 : event.deltaMode === 2 ? 400 : 1;
    const delta = Math.max(-100, Math.min(100, event.deltaY * lines));
    this.draft.set(zoomPortraitFit(this.freshFit(), Math.exp(-delta * 0.002), this.framePoint(event)));
    if (this.wheelTimer !== null) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => this.flushWheel(), WHEEL_SETTLE_MS);
  }

  /** Arrow keys move the picture and the plus and minus keys size it, for anyone not using a pointer. */
  protected onKeyDown(event: KeyboardEvent): void {
    if (!this.canEdit() || !this.imageIdentifier()) return;
    const step = event.shiftKey ? NUDGE * 5 : NUDGE;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const move = moves[event.key];
    if (move) this.write(panPortraitFit(this.freshFit(), move.x, move.y));
    else if (event.key === '+' || event.key === '=') this.zoomIn();
    else if (event.key === '-') this.zoomOut();
    else return;
    event.preventDefault();
  }

  protected zoomIn(): void {
    this.write(zoomPortraitFit(this.freshFit(), ZOOM_STEP));
  }

  protected zoomOut(): void {
    this.write(zoomPortraitFit(this.freshFit(), 1 / ZOOM_STEP));
  }

  /** Puts the picture back the way an unfitted one sits: whole and centred. */
  reset(): void {
    this.cancelWheel();
    const character = this.character();
    const image = this.imageIdentifier();
    this.draft.set(null);
    if (!character || !image || !this.canEdit()) return;
    clearPortraitFitOf(character, this.frame, image);
  }

  /**
   * The fit as it stands this moment, for a change to start from. The character is read directly,
   * since what it hears of its own last write reaches `fit` only once the change has gone round.
   */
  private freshFit(): CutInPortraitFit {
    const draft = this.draft();
    if (draft) return draft;
    const character = this.character();
    const image = this.imageIdentifier();
    const saved = character && image ? portraitFitOf(character, this.frame, image) : null;
    return saved ? currentPortraitFit(saved, this.imageAspect()) : { ...DEFAULT_CUT_IN_PORTRAIT_FIT };
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
    this.grabbing.set(true);
    const [a, b] = [...this.pointers.values()];
    if (a && b) {
      this.gesture = { kind: 'pinch', from, centre: midpoint(a, b), distance: distance(a, b) };
      return;
    }
    this.gesture = { kind: 'pan', from, start: a };
  }

  /** Writes what a gesture got to, once, and lets go of it. */
  private endGesture(): void {
    this.pointers.clear();
    const wasGesturing = this.gesture !== null;
    this.gesture = null;
    this.grabbing.set(false);
    const draft = this.draft();
    if (wasGesturing && draft) this.write(draft);
    else this.draft.set(null);
  }

  /** Writes what the wheel got to, if it is still waiting to be written. */
  private flushWheel(): void {
    if (this.wheelTimer === null) return;
    this.cancelWheel();
    const draft = this.draft();
    if (draft) this.write(draft);
  }

  private cancelWheel(): void {
    if (this.wheelTimer !== null) clearTimeout(this.wheelTimer);
    this.wheelTimer = null;
  }

  /** Where a pointer is, in frame pixels from the frame's centre. */
  private framePoint(event: { clientX: number; clientY: number }): Point {
    const clientX = Number.isFinite(event.clientX) ? event.clientX : 0;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : 0;
    const bounds = this.frameBox()?.nativeElement.getBoundingClientRect();
    // Not laid out, as under test: screen pixels stand in for frame pixels.
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return { x: clientX, y: clientY };
    const unit = PORTRAIT_FRAME_WIDTH / bounds.width;
    return {
      x: (clientX - (bounds.left + bounds.width / 2)) * unit,
      y: (clientY - (bounds.top + bounds.height / 2)) * unit,
    };
  }

  private watchedCharacter(): GameCharacter | null {
    const character = this.character();
    if (character) this.objectChange.versionOf(character.identifier)();
    return character;
  }
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
