import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ModalService } from '@axe/application/ui/modal.service';
import { TranslocoModule } from '@jsverse/transloco';

/** One hand the cards can be dealt into: a participant's, or a character's. */
export interface DealChoiceSeat {
  userId: string;
  name: string;
  /** A character's hand rather than a participant's. */
  character: boolean;
}

export interface DealChoiceDialogOption {
  seats: readonly DealChoiceSeat[];
}

/**
 * Asks which hands a stack is dealt out to, every one ticked to begin with. Closes with the hands
 * ticked, or null when cancelled.
 */
@Component({
  selector: 'deal-choice-dialog',
  templateUrl: './deal-choice-dialog.component.html',
  host: { class: 'block text-ui-text' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
})
export class DealChoiceDialogComponent {
  private readonly modalService = inject(ModalService);

  protected readonly seats: readonly DealChoiceSeat[] =
    (this.modalService.option as Partial<DealChoiceDialogOption> | undefined)?.seats ?? [];
  private readonly picked = signal<ReadonlySet<string>>(new Set(this.seats.map((seat) => seat.userId)));

  /** Whether any hand is ticked, which dealing needs. */
  protected readonly anyPicked = computed(() => this.picked().size > 0);

  protected isPicked(userId: string): boolean {
    return this.picked().has(userId);
  }

  protected toggle(userId: string): void {
    this.picked.update((picked) => {
      const next = new Set(picked);
      if (!next.delete(userId)) next.add(userId);
      return next;
    });
  }

  /** Closes with the hands ticked, in the order they are listed. */
  protected confirm(): void {
    if (!this.anyPicked()) return;
    this.modalService.resolve(this.seats.filter((seat) => this.picked().has(seat.userId)).map((seat) => seat.userId));
  }

  /** Closes with null, so nothing is dealt. */
  protected cancel(): void {
    this.modalService.resolve(null);
  }
}
