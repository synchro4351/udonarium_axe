import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TEST_PROVIDERS } from '@axe/testing/test-providers';
import { TextFormatSwitchComponent } from '@axe/ui/components/text-format-switch/text-format-switch.component';

describe('TextFormatSwitchComponent', () => {
  let fixture: ComponentFixture<TextFormatSwitchComponent>;

  const radios = () => [...fixture.nativeElement.querySelectorAll('button[role="radio"]')] as HTMLButtonElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [TextFormatSwitchComponent], providers: [...TEST_PROVIDERS] });
    fixture = TestBed.createComponent(TextFormatSwitchComponent);
    fixture.detectChanges();
  });

  it('offers normal and formatted, with the current one checked', () => {
    expect(radios().map((radio) => radio.dataset['format'])).toEqual(['normal', 'formatted']);
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);

    fixture.componentRef.setInput('value', 'formatted');
    fixture.detectChanges();
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true']);
  });

  it('emits the chosen format, but not for the one already chosen', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((format) => emitted.push(format));

    radios()[0].click();
    radios()[1].click();
    expect(emitted).toEqual(['formatted']);
  });

  it('emits nothing while disabled', () => {
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((format) => emitted.push(format));
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    radios()[1].click();
    expect(emitted).toEqual([]);
    expect(radios().every((radio) => radio.disabled)).toBe(true);
  });
});
