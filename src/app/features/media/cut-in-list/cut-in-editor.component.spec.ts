import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { ObjectStore } from '@axe/core/sync/object-store';
import { GameCharacter } from '@axe/domain/character/game-character';
import { CutIn } from '@axe/domain/media/cut-in';
import { CutInLayer } from '@axe/domain/media/cut-in-layer';
import { CutInScene } from '@axe/domain/media/cut-in-scene';
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

  it('shows portrait controls only for a template and keeps an image fit on the scene', () => {
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

    component.portraitCharacter = character.identifier;
    component.portraitZoom = 2;
    component.portraitX = 40;
    component.portraitY = 20;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-character"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="cut-in-portrait-image"]')).not.toBeNull();
    expect(JSON.parse(scene.portraitFits)['hero-image']).toEqual({ zoom: 2, x: 40, y: 20 });
  });
});
