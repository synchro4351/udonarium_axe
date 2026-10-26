import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Closes a `<details>` used as a small pop-up when the reader presses anywhere outside it, or
 * presses Escape, as a menu does, rather than only when its summary is pressed again.
 */
@Directive({ selector: 'details[appCloseOutside]' })
export class CloseOutsideDirective {
  private readonly elementRef = inject<ElementRef<HTMLDetailsElement>>(ElementRef);

  constructor() {
    const onPress = (event: Event) => {
      const details = this.elementRef.nativeElement;
      if (details.open && !details.contains(event.target as Node | null)) details.open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.elementRef.nativeElement.open = false;
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey, true);
    });
  }
}
