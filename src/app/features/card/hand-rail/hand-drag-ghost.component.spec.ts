import { TestBed } from '@angular/core/testing';
import { Card } from '@axe/domain/card/card';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { HandDragGhostComponent } from '@axe/features/card/hand-rail/hand-drag-ghost.component';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';

describe('HandDragGhostComponent', () => {
  let card: Card;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HandDragGhostComponent], providers: [...TEST_PROVIDERS] });
    card = Card.create('カード', './assets/images/trump/s01.webp', './assets/images/trump/z01.webp');
  });

  afterEach(() => {
    const drag = TestBed.inject(HandDragService);
    drag.end();
    drag.endDraw();
    card.destroy();
  });

  it('shows only the image the hand overview gave for a card being drawn, never its front', () => {
    const fixture = TestBed.createComponent(HandDragGhostComponent);
    const root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="hand-drag-ghost"]')).toBeNull();

    TestBed.inject(HandDragService).beginDraw(card, 'back-only.png', 10, 10);
    fixture.detectChanges();
    const image = root.querySelector<HTMLImageElement>('[data-testid="hand-drag-ghost"] img');
    expect(image?.getAttribute('src')).toBe('back-only.png');

    TestBed.inject(HandDragService).endDraw();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="hand-drag-ghost"]')).toBeNull();
  });
});
