import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CloseOutsideDirective } from '@axe/ui/directives/close-outside.directive';

@Component({
  imports: [CloseOutsideDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<details appCloseOutside open>
      <summary>色</summary>
      <button type="button" class="inside">赤</button>
    </details>
    <button type="button" class="outside">ほか</button>`,
})
class HostComponent {}

describe('CloseOutsideDirective', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, details: root.querySelector('details')! };
  }

  const press = (target: Element) => target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('closes when something outside it is pressed', () => {
    const { root, details } = render();
    press(root.querySelector('.outside')!);
    expect(details.open).toBe(false);
  });

  it('stays open while what is inside it is pressed', () => {
    const { root, details } = render();
    press(root.querySelector('.inside')!);
    expect(details.open).toBe(true);
  });

  it('closes on Escape', () => {
    const { details } = render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(details.open).toBe(false);
  });

  it('stops listening once it is gone', () => {
    const { fixture, root, details } = render();
    fixture.destroy();
    details.open = true;
    press(root.querySelector('.outside')!);
    expect(details.open).toBe(true);
  });
});
