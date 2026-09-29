import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { setPortraitFitOf } from '@axe/domain/character/character-portrait-fit';
import { GameCharacter } from '@axe/domain/character/game-character';
import { CutIn } from '@axe/domain/media/cut-in';
import { CutInLauncher } from '@axe/domain/media/cut-in-launcher';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { CutInScene } from '@axe/domain/media/cut-in-scene';
import { CutInPortraitPickService } from '@axe/features/media/cut-in-editor/cut-in-portrait-pick.service';
import { CutInPortraitPickerComponent } from '@axe/features/media/cut-in-editor/cut-in-portrait-picker.component';
import { CutInEditorComponent } from '@axe/features/media/cut-in-list/cut-in-editor.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('CutInEditorComponent', () => {
  let component: CutInEditorComponent;
  let fixture: ComponentFixture<CutInEditorComponent>;
  let cutIn: CutIn;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CutInEditorComponent],
      providers: [...TEST_PROVIDERS],
    }).compileComponents();

    const objectStore = TestBed.inject(ObjectStore);
    cutIn = new CutIn('cut-in-under-edit');
    cutIn.imageIdentifier = '';
    cutIn.initialize();
    objectStore.add(cutIn);

    fixture = TestBed.createComponent(CutInEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cutIn', cutIn);
    fixture.componentRef.setInput('isEditable', true);
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('the picture it shows for a cut-in', () => {
    it('asks for a picture rather than showing a broken one where none is set', () => {
      expect(component.cutInImageUrl()).toBe('');
      expect(fixture.nativeElement.querySelector('img')).toBeNull();
      expect(fixture.nativeElement.querySelector('.material-icons')?.textContent).toBe('add_photo_alternate');
    });

    it('shows the picture once one is set', () => {
      TestBed.inject(ImageStorage).add('a-picture');
      cutIn.imageIdentifier = 'a-picture';
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('img')).not.toBeNull();
    });
  });

  it('shows portrait choices only for a template, and never writes a fit onto the scene', () => {
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-character"]')).toBeNull();
    const scene = new CutInScene();
    scene.cutInIdentifier = cutIn.identifier;
    scene.initialize();
    const layer = new CutInLayer();
    layer.kind = 'image';
    layer.portraitSlot = true;
    layer.initialize();
    scene.appendChild(layer);
    const character = GameCharacter.create('Hero', 1, 'hero-image');
    fixture.detectChanges();

    const picker = fixture.debugElement.query(By.directive(CutInPortraitPickerComponent))
      .componentInstance as CutInPortraitPickerComponent;
    picker.character = character.identifier;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-character"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-image"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-zoom"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="cut-in-portrait-fit-note"]')).not.toBeNull();
    expect(scene.portraitFits).toBe('');
  });

  it('launches a portrait template with the fit the chosen character keeps', () => {
    const scene = new CutInScene();
    scene.cutInIdentifier = cutIn.identifier;
    scene.initialize();
    const layer = new CutInLayer();
    layer.kind = 'image';
    layer.portraitSlot = true;
    layer.initialize();
    scene.appendChild(layer);
    const character = GameCharacter.create('Hero', 1, 'hero-image');
    setPortraitFitOf(character, 'bust', 'hero-image', { zoom: 2, x: 40, y: 20 });
    TestBed.inject(CutInPortraitPickService).choose(cutIn.identifier, {
      characterIdentifier: character.identifier,
      imageIdentifier: 'hero-image',
    });
    const launcher = new CutInLauncher('CutInLauncher');
    launcher.initialize();
    TestBed.inject(ObjectStore).add(launcher);
    const spy = vi.spyOn(launcher, 'startCutIn').mockImplementation(() => {});
    fixture.detectChanges();

    component.playCutIn();

    expect(spy).toHaveBeenCalledWith(
      cutIn,
      '',
      expect.objectContaining({ imageIdentifier: 'hero-image', fit: { zoom: 2, x: 40, y: 20 } })
    );
  });

  it('launches with the character chosen on either tab, and their name for a scene that names them', () => {
    const scene = new CutInScene();
    scene.cutInIdentifier = cutIn.identifier;
    scene.initialize();
    const layer = new CutInLayer();
    layer.kind = 'text';
    layer.text = '{character} 参戦！';
    layer.initialize();
    scene.appendChild(layer);
    const character = GameCharacter.create('Hero', 1, 'hero-image');
    TestBed.inject(CutInPortraitPickService).choose(cutIn.identifier, {
      characterIdentifier: character.identifier,
      imageIdentifier: 'hero-image',
    });
    const launcher = new CutInLauncher('CutInLauncher');
    launcher.initialize();
    TestBed.inject(ObjectStore).add(launcher);
    const spy = vi.spyOn(launcher, 'startCutInMySelf').mockImplementation(() => {});
    fixture.detectChanges();

    // Only the name is asked for: the scene has no slot to fit a picture to.
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-character"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-image"]')).toBeNull();

    component.previewCutIn();

    expect(spy).toHaveBeenCalledWith(
      cutIn,
      expect.objectContaining({ characterIdentifier: character.identifier, characterName: 'Hero', imageIdentifier: '' })
    );
  });
});
