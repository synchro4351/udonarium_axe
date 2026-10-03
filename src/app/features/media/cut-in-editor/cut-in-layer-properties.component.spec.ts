import { ComponentFixture, TestBed } from '@angular/core/testing';
import { objectChanged$ } from '@axe/core/sync/object-event-extension';
import { encodeCutInTracks } from '@axe/domain/media/cut-in-keyframe';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { CutInLayerPropertiesComponent } from '@axe/features/media/cut-in-editor/cut-in-layer-properties.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('CutInLayerPropertiesComponent', () => {
  let fixture: ComponentFixture<CutInLayerPropertiesComponent>;
  let component: CutInLayerPropertiesComponent;
  let layer: CutInLayer;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CutInLayerPropertiesComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();
  });

  beforeEach(() => {
    layer = new CutInLayer();
    layer.initialize();
    layer.x = 100;

    fixture = TestBed.createComponent(CutInLayerPropertiesComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('layer', layer);
    fixture.componentRef.setInput('isEditable', true);
    fixture.detectChanges();
  });

  function atPlayhead(ms: number): void {
    fixture.componentRef.setInput('playheadMs', ms);
    fixture.detectChanges();
  }

  it('says nothing without a layer', () => {
    fixture.componentRef.setInput('layer', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('レイヤーを選ぶ');
  });

  it('moves where the layer rests while nothing moves it', () => {
    component.x = 250;

    expect(layer.x).toBe(250);
    expect(layer.tracks).toBe('');
  });

  it('reads what a track says at the scrubber', () => {
    layer.tracks = encodeCutInTracks({
      x: [
        { t: 0, v: 0, e: 'linear' },
        { t: 1000, v: 200 },
      ],
    });
    atPlayhead(500);

    expect(component.x).toBe(100);
  });

  it('writes onto the track once one is there', () => {
    layer.tracks = encodeCutInTracks({
      x: [
        { t: 0, v: 0 },
        { t: 1000, v: 200 },
      ],
    });
    atPlayhead(500);

    component.x = 42;

    expect(component.x).toBe(42);
    expect(layer.x).toBe(100);
  });

  it('puts a key down at the scrubber and takes it up again', () => {
    atPlayhead(400);

    expect(component.keyed('x')).toBe(false);

    component.toggleKey('x');
    expect(component.keyed('x')).toBe(true);

    component.toggleKey('x');
    expect(component.keyed('x')).toBe(false);
  });

  it('keys both directions of the scale together', () => {
    atPlayhead(400);

    component.toggleKey('scaleX');

    expect(component.keyed('scaleX')).toBe(true);
    expect(layer.trackSet.scaleY).toHaveLength(1);
  });

  it('tells the editor after every change', () => {
    let commits = 0;
    component.commit.subscribe(() => commits++);

    component.x = 10;
    component.rotation = 45;

    expect(commits).toBe(2);
  });

  it('changes nothing for a reader', () => {
    fixture.componentRef.setInput('isEditable', false);
    fixture.detectChanges();

    component.x = 999;

    expect(layer.x).toBe(100);
  });

  describe('what a text layer is told', () => {
    beforeEach(() => {
      layer.kind = 'text';
      fixture.detectChanges();
    });

    it('takes the words and the way they look', () => {
      component.text = '見せ場だ';
      component.fontSizePx = 64;
      component.color = '#ff8800';
      component.textAlign = 'left';

      expect(layer.text).toBe('見せ場だ');
      expect(layer.fontSizePx).toBe(64);
      expect(layer.color).toBe('#ff8800');
      expect(layer.textAlign).toBe('left');
    });

    it('offers font presets without changing an existing custom font', () => {
      component.fontFamily = 'My Table Font, serif';
      expect(component.selectedFontOption).toBe('custom');
      expect(layer.fontFamily).toBe('My Table Font, serif');

      const mincho = component.fontOptions.find((option) => option.name === 'mincho');
      expect(mincho).toBeDefined();
      component.selectedFontOption = mincho!.value;
      expect(component.selectedFontOption).toBe(mincho!.value);
      expect(layer.fontFamily).toBe(mincho!.value);

      component.selectedFontOption = '';
      expect(layer.fontFamily).toBe('');
    });

    it('writes a selected font from the dropdown', async () => {
      const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
        'select[name="cut-in-layer-font-option"]'
      );
      expect(select).not.toBeNull();
      select!.value = component.fontOptions[1].value;
      select!.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(layer.fontFamily).toBe(component.fontOptions[1].value);
    });

    it('holds the weight to what a font has', () => {
      component.fontWeight = 5000;
      expect(layer.fontWeight).toBe(900);

      component.fontWeight = 0;
      expect(layer.fontWeight).toBe(400);
    });

    it('turns away an alignment that means nothing', () => {
      component.textAlign = 'sideways' as never;

      expect(layer.textAlign).toBe('center');
    });

    it('never gives the outline a negative width', () => {
      component.strokeWidthPx = -4;

      expect(layer.strokeWidthPx).toBe(0);
    });
  });

  describe('what a band layer is told', () => {
    beforeEach(() => {
      layer.kind = 'fill';
      fixture.detectChanges();
    });

    it('starts as one flat colour', () => {
      expect(component.fillGradient).toBe(false);
    });

    it('shades into another colour when asked, starting from the one it has', () => {
      component.fillFrom = '#102030';
      component.fillGradient = true;

      expect(layer.fillTo).toBe('#102030');
      expect(component.fillGradient).toBe(true);
    });

    it('goes back to one colour when told to', () => {
      component.fillGradient = true;
      component.fillGradient = false;

      expect(layer.fillTo).toBe('');
    });

    it('takes the angle it shades along', () => {
      component.fillAngleDeg = 45;

      expect(layer.fillAngleDeg).toBe(45);
    });

    it('takes the shape the shading runs in', () => {
      component.fillShape = 'radial';

      expect(layer.fillShape).toBe('radial');
    });

    it('turns away a shape it does not know', () => {
      component.fillShape = 'spiral' as never;

      expect(layer.fillShape).toBe('linear');
    });

    it('passes through a third colour when asked', () => {
      expect(component.fillHasMid).toBe(false);

      component.fillHasMid = true;

      expect(layer.fillMid.length).toBeGreaterThan(0);
      expect(component.fillHasMid).toBe(true);
    });

    it('drops the third colour again', () => {
      component.fillHasMid = true;
      component.fillHasMid = false;

      expect(layer.fillMid).toBe('');
    });
  });

  describe('the curve out of a key', () => {
    it('is offered only where a key stands', () => {
      atPlayhead(400);
      expect(component.keyedHere).toBe(false);

      component.toggleKey('x');
      expect(component.keyedHere).toBe(true);
    });

    it('starts as the one a new key is drawn with', () => {
      atPlayhead(400);
      component.toggleKey('x');

      expect(component.easingHere).toBe('outCubic');
    });

    it('is written to every key standing there', () => {
      atPlayhead(400);
      component.toggleKey('x');
      component.toggleKey('opacity');

      component.easingHere = 'linear';

      expect(layer.trackSet.x?.[0].e).toBe('linear');
      expect(layer.trackSet.opacity?.[0].e).toBe('linear');
    });

    it('says nothing where the keys standing there disagree', () => {
      atPlayhead(400);
      component.toggleKey('x');
      component.toggleKey('opacity');
      component.easingHere = 'linear';
      layer.tracks = layer.tracks.replace('"e":"linear"', '"e":"outBack"');

      expect(component.easingHere).toBe('');
    });

    it('turns away a curve it does not know', () => {
      atPlayhead(400);
      component.toggleKey('x');

      component.easingHere = 'nonsense' as never;

      expect(component.easingHere).toBe('outCubic');
    });
  });

  describe('the ready-made ways in and out', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('sceneWidth', 640);
      fixture.componentRef.setInput('sceneHeight', 360);
      fixture.componentRef.setInput('sceneDurationMs', 3000);
      fixture.detectChanges();
    });

    it('lays the keys of an entrance down', () => {
      component.entrance = 'slideInLeft';

      expect(layer.trackSet.x).toHaveLength(2);
      expect(layer.trackSet.x?.[1].v).toBe(100);
    });

    it('lays the keys of an exit down, ending with the scene', () => {
      component.exit = 'fadeOut';

      expect(layer.trackSet.opacity?.[1].t).toBe(3000);
    });

    it('goes back to offering rather than remembering', () => {
      component.entrance = 'fadeIn';

      expect(component.entrance).toBe('');
    });

    it('takes how long it should last', () => {
      component.presetMs = 900;
      component.entrance = 'fadeIn';

      expect(layer.trackSet.opacity?.[1].t).toBe(900);
    });

    it('turns away a preset it does not know', () => {
      component.entrance = 'somersault' as never;

      expect(layer.tracks).toBe('');
    });

    it('changes nothing for a reader', () => {
      fixture.componentRef.setInput('isEditable', false);
      fixture.detectChanges();

      component.entrance = 'fadeIn';

      expect(layer.tracks).toBe('');
    });
  });

  describe('the touch a layer wears', () => {
    it('starts wearing none', () => {
      expect(component.effect).toBe('none');
      expect(component.effectHasColor).toBe(false);
    });

    it('takes a touch and how strong it is', () => {
      component.effect = 'shake';
      component.effectStrength = 150;

      expect(layer.effect).toBe('shake');
      expect(layer.effectStrength).toBeCloseTo(1.5, 5);
    });

    it('holds the strength to what makes sense', () => {
      component.effectStrength = 9000;

      expect(layer.effectStrength).toBe(3);
    });

    it('offers a colour only for the one that has one', () => {
      component.effect = 'glow';
      expect(component.effectHasColor).toBe(true);

      component.effect = 'shake';
      expect(component.effectHasColor).toBe(false);
    });

    it('turns away a touch it does not know', () => {
      component.effect = 'sparkle' as never;

      expect(layer.effect).toBe('none');
    });
  });

  describe('a whole look', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('sceneWidth', 640);
      fixture.componentRef.setInput('sceneHeight', 360);
      fixture.componentRef.setInput('sceneDurationMs', 3000);
      fixture.detectChanges();
    });

    it('writes the arrival, the departure and the touch at once', () => {
      component.look = 'impact';

      expect(layer.effect).toBe('shake');
      expect(layer.trackSet.scaleX?.length).toBeGreaterThan(1);
    });

    it('goes back to offering rather than remembering', () => {
      component.look = 'headline';

      expect(component.look).toBe('');
    });

    it('leaves the layer alone for a look it does not know', () => {
      component.look = 'nonsense';

      expect(layer.tracks).toBe('');
    });
  });

  describe('the shape a layer is cut down to', () => {
    it('keeps its own box to begin with', () => {
      expect(component.clip).toBe('none');
    });

    it('takes an outline to be cut to', () => {
      component.clip = 'torn';

      expect(layer.clip).toBe('torn');
    });

    it('turns away an outline it does not know', () => {
      component.clip = 'trapezoid' as never;

      expect(layer.clip).toBe('none');
    });

    it('takes a lean, held to what still leaves something to see', () => {
      component.skewXDeg = 30;
      expect(layer.skewXDeg).toBe(30);

      component.skewXDeg = 400;
      expect(layer.skewXDeg).toBe(80);

      component.skewYDeg = -400;
      expect(layer.skewYDeg).toBe(-80);
    });
  });

  describe('a fill that repeats', () => {
    beforeEach(() => {
      layer.kind = 'fill';
      fixture.detectChanges();
    });

    it('offers a pitch only for the fills that repeat', () => {
      component.fillShape = 'linear';
      expect(component.fillRepeats).toBe(false);

      component.fillShape = 'halftone';
      expect(component.fillRepeats).toBe(true);

      component.fillShape = 'speedlines';
      expect(component.fillRepeats).toBe(true);
    });

    it('takes the pitch, held to what can still be seen', () => {
      component.fillScalePx = 40;
      expect(layer.fillScalePx).toBe(40);

      component.fillScalePx = 9999;
      expect(layer.fillScalePx).toBe(200);

      component.fillScalePx = 0;
      expect(layer.fillScalePx).toBe(24);
    });
  });

  describe('letting a layer in a part at a time', () => {
    it('lets the whole of it in to begin with', () => {
      expect(component.wipeShape).toBe('none');
      expect(component.wipePercent).toBe(100);
    });

    it('takes a way of letting it in', () => {
      component.wipeShape = 'chevronRight';

      expect(layer.wipeShape).toBe('chevronRight');
    });

    it('turns away one it does not know', () => {
      component.wipeShape = 'spiral' as never;

      expect(layer.wipeShape).toBe('none');
    });

    it('leaves a layer just given a wipe fully in rather than shut', () => {
      layer.wipe = 0;

      component.wipeShape = 'right';

      expect(layer.wipe).toBe(1);
    });

    it('takes how far along it is, and can key it', () => {
      component.wipePercent = 40;
      expect(layer.wipe).toBeCloseTo(0.4, 5);

      fixture.componentRef.setInput('playheadMs', 300);
      fixture.detectChanges();
      component.toggleKey('wipe');

      expect(component.keyed('wipe')).toBe(true);
    });
  });

  describe('taking a layer away again', () => {
    it('leaves the whole of it there to begin with', () => {
      expect(component.crumbleShape).toBe('none');
      expect(component.crumblePercent).toBe(100);
    });

    it('takes a way of taking it away, apart from the way it came in', () => {
      component.wipeShape = 'chevronRight';
      component.crumbleShape = 'crumbleLeft';

      expect(layer.wipeShape).toBe('chevronRight');
      expect(layer.crumbleShape).toBe('crumbleLeft');
    });

    it('leaves a layer just given one whole rather than gone', () => {
      layer.crumble = 0;

      component.crumbleShape = 'crumbleLeft';

      expect(layer.crumble).toBe(1);
    });

    it('takes how much is left, and can key it', () => {
      component.crumblePercent = 30;
      expect(layer.crumble).toBeCloseTo(0.3, 5);

      fixture.componentRef.setInput('playheadMs', 400);
      fixture.detectChanges();
      component.toggleKey('crumble');

      expect(component.keyed('crumble')).toBe(true);
    });
  });

  describe('how the words are set', () => {
    beforeEach(() => {
      layer.kind = 'text';
      fixture.detectChanges();
    });

    function field<T extends HTMLElement>(testId: string): T {
      return (fixture.nativeElement as HTMLElement).querySelector<T>(`[data-testid="${testId}"]`)!;
    }

    it('keeps every per-letter control in one folded section, presets before the motion selector', () => {
      const details = field<HTMLDetailsElement>('cut-in-letter-details');
      const inside = (testId: string) => details.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;

      expect(details.open).toBe(false);
      expect(details.querySelector('summary')!.textContent!.trim()).toBe('文字ごと');
      for (const testId of [
        'cut-in-letter-preset-fade',
        'cut-in-letter-preset-pop',
        'cut-in-letter-preset-wave',
        'cut-in-layer-letter-motion',
        'cut-in-letterOrder',
        'cut-in-letterTiltMode',
        'cut-in-letterExit',
        'cut-in-letterDirection',
        'cut-in-letterIntervalMs',
        'cut-in-letterDurationMs',
        'cut-in-letterExitDurationMs',
        'cut-in-layer-letter-tilt',
      ]) {
        expect(inside(testId), testId).not.toBeNull();
      }
      const before = inside('cut-in-letter-preset-wave').compareDocumentPosition(inside('cut-in-layer-letter-motion'));
      expect(before & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('puts all whole-layer settings before the per-letter section', () => {
      const order = [
        'cut-in-section-text',
        'cut-in-layer-details',
        'cut-in-section-motion',
        'cut-in-section-style',
        'cut-in-letter-details',
      ].map((testId) => field(testId));
      for (let i = 1; i < order.length; i++) {
        expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      expect(field<HTMLDetailsElement>('cut-in-section-text').open).toBe(true);
      expect(field<HTMLDetailsElement>('cut-in-layer-details').open).toBe(false);
    });

    it('inserts the character name from the placeholder, not from a button', () => {
      const textarea = fixture.nativeElement.querySelector('textarea[name="cut-in-layer-text"]') as HTMLTextAreaElement;

      expect(textarea.placeholder).toBe('{character}でキャラ名を挿入');
      expect(fixture.nativeElement.querySelector('[data-testid="cut-in-layer-insert-character"]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('キャラ名を入れる');
    });

    it('opens and shuts sections without touching the layer or the undo stack', () => {
      const commit = vi.fn();
      component.commit.subscribe(commit);
      const before = layer.toXml();

      const section = field<HTMLDetailsElement>('cut-in-letter-details');
      section.open = true;
      fixture.detectChanges();
      section.open = false;
      fixture.detectChanges();

      expect(commit).not.toHaveBeenCalled();
      expect(layer.toXml()).toBe(before);
    });

    it('writes each detailed control, held to what it allows, with one undo step each', () => {
      const commit = vi.fn();
      component.commit.subscribe(commit);

      component.setLetterControl('letterOrder', 'reverse');
      component.setLetterControl('letterIntervalMs', 120);
      component.setLetterControl('letterExit', 'rise');
      component.setLetterControl('letterExitDurationMs', 99_999);
      component.setLetterControl('letterDirection', 'diagonal');
      component.setLetterControl('letterDurationMs', null);

      expect(layer).toMatchObject({
        letterOrder: 'reverse',
        letterIntervalMs: 120,
        letterExit: 'rise',
        letterExitDurationMs: 3000,
        letterDirection: 'up',
        letterDurationMs: 260,
      });
      expect(commit).toHaveBeenCalledTimes(6);
    });

    it('puts every detailed control back before laying a simple look on, in one undo step', () => {
      const commit = vi.fn();
      Object.assign(layer, { letterOrder: 'center', letterIntervalMs: 500, letterExit: 'rise', letterTiltDeg: 12 });
      component.commit.subscribe(commit);

      component.applyLetterPreset('fade');

      expect(layer).toMatchObject({
        letterMotion: 'fade',
        letterOrder: 'forward',
        letterIntervalMs: 60,
        letterDurationMs: 400,
        letterExit: 'none',
        letterTiltDeg: 0,
      });
      expect(commit).toHaveBeenCalledTimes(1);

      component.applyLetterPreset('pop');
      expect(layer).toMatchObject({ letterMotion: 'pop', letterDurationMs: 260, letterTiltDeg: 5 });
    });

    it('writes a detailed control chosen from its list', async () => {
      const select = field<HTMLSelectElement>('cut-in-letterOrder');
      select.value = 'center';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(layer.letterOrder).toBe('center');
    });

    it('shows a control changed elsewhere in the room, and an unknown one as its default', async () => {
      layer.letterExit = 'shrink';
      layer.letterIntervalMs = 240;
      objectChanged$.emit({ identifier: layer.identifier, aliasName: layer.aliasName, isSendFromSelf: false });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(field<HTMLSelectElement>('cut-in-letterExit').value).toBe('shrink');
      expect(field<HTMLInputElement>('cut-in-letterIntervalMs').value).toBe('240');

      layer.letterOrder = 'sideways' as never;
      expect(component.letterControls.letterOrder).toBe('forward');
    });

    const detailedControls = [
      'letterOrder',
      'letterTiltMode',
      'letterExit',
      'letterDirection',
      'letterIntervalMs',
      'letterDurationMs',
      'letterExitDurationMs',
    ] as const;

    /** The detailed controls that can be changed, once the form has caught up with the layer. */
    async function openControls(): Promise<string[]> {
      fixture.detectChanges();
      // A form control takes its disabled state on the microtask after the binding changes.
      await fixture.whenStable();
      return detailedControls.filter((control) => !field<HTMLInputElement>(`cut-in-${control}`).disabled);
    }

    it('opens only the controls that change anything for the motion and exit, keeping what the rest hold', async () => {
      Object.assign(layer, { letterDirection: 'left', letterDurationMs: 700, letterExitDurationMs: 900 });
      const always = ['letterOrder', 'letterTiltMode', 'letterExit'];

      expect(await openControls()).toEqual(always);

      component.letterMotion = 'slide';
      expect(await openControls()).toEqual([...always, 'letterDirection', 'letterIntervalMs', 'letterDurationMs']);

      component.letterMotion = 'fade';
      expect(await openControls()).toEqual([...always, 'letterIntervalMs', 'letterDurationMs']);
      expect(field<HTMLSelectElement>('cut-in-letterDirection').value).toBe('left');

      component.letterMotion = 'wave';
      component.setLetterControl('letterExit', 'shrink');
      expect(await openControls()).toEqual([...always, 'letterIntervalMs', 'letterExitDurationMs']);
      expect(field<HTMLInputElement>('cut-in-letterDurationMs').value).toBe('700');

      component.setLetterControl('letterExit', 'none');
      expect(await openControls()).toEqual(always);
      expect(layer).toMatchObject({ letterDirection: 'left', letterDurationMs: 700, letterExitDurationMs: 900 });
      expect(field<HTMLInputElement>('cut-in-letterExitDurationMs').value).toBe('900');
    });

    it('opens and shuts the controls as the motion and exit change elsewhere in the room', async () => {
      expect(await openControls()).not.toContain('letterDirection');

      layer.letterMotion = 'pop';
      layer.letterExit = 'rise';
      objectChanged$.emit({ identifier: layer.identifier, aliasName: layer.aliasName, isSendFromSelf: false });

      expect(await openControls()).toEqual(detailedControls);

      layer.letterMotion = 'shake';
      objectChanged$.emit({ identifier: layer.identifier, aliasName: layer.aliasName, isSendFromSelf: false });

      expect(await openControls()).toEqual([
        'letterOrder',
        'letterTiltMode',
        'letterExit',
        'letterIntervalMs',
        'letterExitDurationMs',
      ]);
    });

    it('changes nothing for a reader and locks every detailed control, even those in use', async () => {
      component.letterMotion = 'pop';
      component.setLetterControl('letterExit', 'fade');
      expect(await openControls()).toEqual(detailedControls);

      fixture.componentRef.setInput('isEditable', false);

      expect(await openControls()).toEqual([]);
      component.setLetterControl('letterIntervalMs', 200);
      component.applyLetterPreset('wave');

      expect(layer.letterIntervalMs).toBe(60);
      expect(layer.letterMotion).toBe('pop');
      expect(field<HTMLButtonElement>('cut-in-letter-preset-pop').disabled).toBe(true);
    });

    it('pulls the letters together or pushes them apart', () => {
      component.letterSpacingPx = -12;

      expect(layer.letterSpacingPx).toBe(-12);
    });

    it('takes the space between the lines, held to what stays readable', () => {
      component.lineHeight = 180;
      expect(layer.lineHeight).toBeCloseTo(1.8, 5);

      component.lineHeight = 9999;
      expect(layer.lineHeight).toBe(4);
    });

    it('sets the words downwards when asked', () => {
      component.vertical = true;

      expect(layer.vertical).toBe(true);
    });
  });

  describe('how the controls are grouped', () => {
    const host = () => fixture.nativeElement as HTMLElement;
    const section = (testId: string) => host().querySelector<HTMLDetailsElement>(`[data-testid="${testId}"]`);
    const names = (root: ParentNode) =>
      Array.from(root.querySelectorAll<HTMLElement>('[name]')).map((element) => element.getAttribute('name'));

    const positionNames = [
      'cut-in-layer-x',
      'cut-in-layer-y',
      'cut-in-layer-width',
      'cut-in-layer-height',
      'cut-in-layer-scale',
      'cut-in-layer-rotation',
    ];
    const motionNames = [
      'cut-in-layer-start',
      'cut-in-layer-end',
      'cut-in-layer-entrance',
      'cut-in-layer-exit',
      'cut-in-layer-preset-ms',
      'cut-in-layer-wipe',
      'cut-in-layer-crumble',
    ];
    const styleNames = [
      'cut-in-layer-opacity',
      'cut-in-layer-blur',
      'cut-in-layer-skew-x',
      'cut-in-layer-skew-y',
      'cut-in-layer-clip',
      'cut-in-layer-effect',
      'cut-in-layer-look',
    ];

    it('splits position, whole-layer motion and look into three folded sections for every kind', () => {
      for (const kind of ['image', 'text', 'fill'] as const) {
        layer.kind = kind;
        fixture.detectChanges();

        const position = section('cut-in-layer-details')!;
        const motion = section('cut-in-section-motion')!;
        const style = section('cut-in-section-style')!;
        expect([position.open, motion.open, style.open], kind).toEqual([false, false, false]);
        expect(names(position), kind).toEqual(positionNames);
        expect(names(motion), kind).toEqual(motionNames);
        expect(names(style), kind).toEqual(styleNames);
        expect(
          [position, motion, style].map((element) => element.querySelector('summary')!.textContent!.trim()),
          kind
        ).toEqual(['位置とサイズ', '全体の動き', '見た目と効果']);
      }
    });

    it('keeps the band colours in an open band section and has no text or per-letter section', () => {
      layer.kind = 'fill';
      fixture.detectChanges();

      expect(section('cut-in-section-band')!.open).toBe(true);
      expect(names(section('cut-in-section-band')!)).toContain('cut-in-layer-fill-from');
      expect(section('cut-in-section-text')).toBeNull();
      expect(section('cut-in-letter-details')).toBeNull();
    });

    it('shows the image controls plainly, with the portrait note as a tooltip rather than a paragraph', () => {
      layer.kind = 'image';
      layer.portraitSlot = true;
      fixture.detectChanges();

      expect(names(host())).toContain('cut-in-layer-portrait-slot');
      expect(host().querySelector('label[title]')!.getAttribute('title')).toBe(
        '画像がない場合はシルエットを表示します。'
      );
      expect(host().textContent).not.toContain('画像がない場合はシルエットを表示します。');
      expect(section('cut-in-section-text')).toBeNull();
    });

    it('reveals the wipe and crumble amounts, with their keys, inside the motion section only when chosen', () => {
      const motion = section('cut-in-section-motion')!;
      expect(names(motion)).not.toContain('cut-in-layer-wipe-amount');

      component.wipeShape = 'right';
      component.crumbleShape = 'crumbleLeft';
      fixture.detectChanges();

      expect(names(motion)).toEqual(
        expect.arrayContaining(['cut-in-layer-wipe-amount', 'cut-in-layer-crumble-amount'])
      );
    });

    it('offers the curve inside the motion section once a key stands at the scrubber', async () => {
      atPlayhead(400);
      component.toggleKey('x');
      objectChanged$.emit({ identifier: layer.identifier, aliasName: layer.aliasName, isSendFromSelf: false });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(names(section('cut-in-section-motion')!)).toContain('cut-in-layer-easing');
    });

    it('shows the effect strength and colour inside the look section as the effect needs them', () => {
      component.effect = 'glow';
      fixture.detectChanges();

      expect(names(section('cut-in-section-style')!)).toEqual(
        expect.arrayContaining(['cut-in-layer-effect-strength', 'cut-in-layer-effect-color'])
      );
    });

    it('locks every control in every section for a reader, folded sections included', async () => {
      layer.kind = 'text';
      layer.wipeShape = 'right';
      fixture.componentRef.setInput('isEditable', false);
      fixture.detectChanges();
      await fixture.whenStable();

      const controls = Array.from(host().querySelectorAll<HTMLInputElement>('input, select, textarea, button'));
      expect(controls.length).toBeGreaterThan(40);
      expect(controls.filter((control) => !control.disabled).map((control) => control.name)).toEqual([]);
    });
  });
});
