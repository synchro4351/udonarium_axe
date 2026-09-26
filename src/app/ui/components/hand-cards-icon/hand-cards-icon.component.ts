import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Two cards fanned out, the front one marked with a star: the icon of the hand.
 *
 * Drawn in `currentColor`, so it follows the text colour of the menu it sits in, and sized by the
 * box it is given. The front card is set apart from the back one by a gap cut into the back card's
 * outline, not by a painted border, so it reads the same on any background.
 */
@Component({
  selector: 'ui-hand-cards-icon',
  templateUrl: './hand-cards-icon.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block shrink-0', 'aria-hidden': 'true' },
})
export class UiHandCardsIconComponent {}
