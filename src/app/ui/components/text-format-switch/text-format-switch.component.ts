import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TEXT_FORMATS, TextFormat } from '@axe/domain/data/text-format';
import { TranslocoModule } from '@jsverse/transloco';

/** The small 通常/整形 switch every text field with an optional formatted display shares. */
@Component({
  selector: 'text-format-switch',
  templateUrl: './text-format-switch.component.html',
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class TextFormatSwitchComponent {
  readonly value = input<TextFormat>('normal');
  readonly disabled = input(false);
  readonly valueChange = output<TextFormat>();

  protected readonly formats = TEXT_FORMATS;

  protected select(format: TextFormat): void {
    if (this.disabled() || format === this.value()) return;
    this.valueChange.emit(format);
  }
}
