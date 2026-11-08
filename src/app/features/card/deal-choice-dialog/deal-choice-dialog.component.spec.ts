import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalService } from '@axe/application/ui/modal.service';
import { STORAGE_KEYS } from '@axe/core/storage/storage-keys';
import { DealChoiceDialogComponent } from '@axe/features/card/deal-choice-dialog/deal-choice-dialog.component';

describe('DealChoiceDialogComponent', () => {
  let fixture: ComponentFixture<DealChoiceDialogComponent>;
  let resolve: ReturnType<typeof vi.fn>;

  afterEach(() => localStorage.removeItem(STORAGE_KEYS.dealChoice));

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEYS.dealChoice);
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

  it('ticks every participant to begin with, and deals to those ticked, remembering them', () => {
    expect(boxes().map((box) => box.checked)).toEqual([true, false]);

    boxes()[1].click();
    boxes()[0].click();
    fixture.detectChanges();
    confirm().click();

    expect(resolve).toHaveBeenCalledWith(['chr:c1']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dealChoice)!)).toEqual(['chr:c1']);
  });

  it('starts from the hands picked last time, where they are still here', async () => {
    localStorage.setItem(STORAGE_KEYS.dealChoice, JSON.stringify(['chr:c1', 'gone']));
    fixture = TestBed.createComponent(DealChoiceDialogComponent);
    fixture.detectChanges();

    expect(boxes().map((box) => box.checked)).toEqual([false, true]);
  });

  it('will not deal with no hand ticked', () => {
    for (const box of boxes()) if (box.checked) box.click();
    fixture.detectChanges();

    expect(confirm().disabled).toBe(true);
  });
});
