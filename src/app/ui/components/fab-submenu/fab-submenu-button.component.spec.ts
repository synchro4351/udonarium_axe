import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HAND_CARDS_ICON } from '@axe/domain/ui/custom-icon';
import { UiFabSubmenuButtonComponent } from '@axe/ui/components/fab-submenu/fab-submenu-button.component';

describe('UiFabSubmenuButtonComponent', () => {
  let fixture: ComponentFixture<UiFabSubmenuButtonComponent>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function set(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [UiFabSubmenuButtonComponent] });
    fixture = TestBed.createComponent(UiFabSubmenuButtonComponent);
    set('label', 'Clock');
    set('icon', 'schedule');
  });

  it('names itself in the bubble beside it and to the reader, not with the browser tooltip', () => {
    expect(button().querySelector('i')!.textContent!.trim()).toBe('schedule');
    expect(button().getAttribute('data-label')).toBe('Clock');
    expect(button().getAttribute('aria-label')).toBe('Clock');
    expect(button().hasAttribute('title')).toBe(false);
  });

  it('writes a few letters in place of the icon when given them', () => {
    set('text', 'JA');

    expect(button().textContent!.trim()).toBe('JA');
    expect(button().querySelector('i')).toBeNull();
  });

  it('draws the hand icon itself instead of asking the icon font for it', () => {
    set('icon', HAND_CARDS_ICON);
    set('badge', true);

    const svg = button().querySelector('ui-hand-cards-icon svg')!;
    expect(button().querySelector('i')).toBeNull();
    expect(svg.getAttribute('fill')).toBe('currentColor');
    expect(svg.querySelector('[data-part="front-card"]')!.getAttribute('fill-rule')).toBe('evenodd');
    expect(svg.querySelector('[data-part="back-card"]')).not.toBeNull();
    expect(button().getAttribute('aria-label')).toBe('Clock');
    expect(button().querySelector('.bg-red-500')).not.toBeNull();
  });

  it('says whether what it shows is out only when told', () => {
    expect(button().hasAttribute('aria-pressed')).toBe(false);

    set('lit', true);
    expect(button().getAttribute('aria-pressed')).toBe('true');

    set('lit', false);
    expect(button().getAttribute('aria-pressed')).toBe('false');
  });

  it('says it was pressed, unless it is disabled', () => {
    const presses: MouseEvent[] = [];
    fixture.componentInstance.press.subscribe((event) => presses.push(event));

    button().click();
    set('disabled', true);
    button().click();

    expect(presses).toHaveLength(1);
  });
});
