import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalService } from '@axe/application/ui/modal.service';
import { DealChoiceDialogComponent } from '@axe/features/card/deal-choice-dialog/deal-choice-dialog.component';

describe('DealChoiceDialogComponent', () => {
  let fixture: ComponentFixture<DealChoiceDialogComponent>;
  let resolve: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resolve = vi.fn();
    TestBed.configureTestingModule({ imports: [DealChoiceDialogComponent] });
    TestBed.overrideProvider(ModalService, {
      useValue: {
        option: {
          seats: [
            { userId: 'me', name: 'わたし', character: false },
            { userId: 'chr:c1', name: 'ブレイズ', character: true },
          ],
        },
        resolve,
      },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(DealChoiceDialogComponent);
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const boxes = () => [...root().querySelectorAll<HTMLInputElement>('[data-testid="deal-choice-seat"]')];
  const confirm = () => root().querySelector<HTMLButtonElement>('[data-testid="deal-choice-confirm"]')!;

  it('ticks every hand to begin with, and deals to those left ticked', () => {
    expect(boxes().map((box) => box.checked)).toEqual([true, true]);

    boxes()[0].click();
    fixture.detectChanges();
    confirm().click();

    expect(resolve).toHaveBeenCalledWith(['chr:c1']);
  });

  it('will not deal with no hand ticked', () => {
    for (const box of boxes()) box.click();
    fixture.detectChanges();

    expect(confirm().disabled).toBe(true);
  });
});
