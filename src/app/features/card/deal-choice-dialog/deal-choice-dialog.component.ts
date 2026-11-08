import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ModalService } from '@axe/application/ui/modal.service';
import { STORAGE_KEYS } from '@axe/core/storage/storage-keys';
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

/** The hands picked the last time a stack was dealt out in this browser, or null for none yet. */
function rememberedPick(): string[] | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.dealChoice) ?? 'null');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

function rememberPick(picked: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.dealChoice, JSON.stringify(picked));
  } catch {
    // A browser that keeps nothing asks afresh each time.
  }
}

/**
 * Asks which hands a stack is dealt out to: the ones picked last time in this browser, or every
 * participant at first. Closes with the hands ticked, or null when cancelled.
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
  private readonly picked = signal<ReadonlySet<string>>(this.startingPick());

  /** Whether any hand is ticked, which dealing needs. */
  protected readonly anyPicked = computed(() => this.picked().size > 0);

  private startingPick(): ReadonlySet<string> {
    const remembered = rememberedPick();
    const here = new Set(this.seats.map((seat) => seat.userId));
    if (remembered && remembered.some((id) => here.has(id))) return new Set(remembered.filter((id) => here.has(id)));
    return new Set(this.seats.filter((seat) => !seat.character).map((seat) => seat.userId));
  }

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
    const picked = this.seats.filter((seat) => this.picked().has(seat.userId)).map((seat) => seat.userId);
    rememberPick(picked);
    this.modalService.resolve(picked);
  }

  /** Closes with null, so nothing is dealt. */
  protected cancel(): void {
    this.modalService.resolve(null);
  }
}
