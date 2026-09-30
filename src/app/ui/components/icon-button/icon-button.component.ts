import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HAND_CARDS_ICON } from '@axe/domain/ui/custom-icon';
import { UiHandCardsIconComponent } from '@axe/ui/components/hand-cards-icon/hand-cards-icon.component';

@Component({
  selector: 'ui-icon-button',
  templateUrl: './icon-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiHandCardsIconComponent],
  host: { class: 'contents' },
})
export class UiIconButtonComponent {
  protected readonly handCardsIcon = HAND_CARDS_ICON;

  /** A Material Icons name, or one the app draws itself. */
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly active = input(false);
  readonly dim = input(false);
  readonly faded = input(false);
  readonly badge = input(false);
  readonly testId = input<string | null>(null);

  readonly press = output<MouseEvent>();
}
