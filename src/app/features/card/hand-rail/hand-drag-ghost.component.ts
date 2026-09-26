import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HandDragService } from '@axe/features/card/hand-rail/hand-drag.service';
import { SafePipe } from '@axe/ui/pipes/safe.pipe';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hand-drag-ghost',
  templateUrl: './hand-drag-ghost.component.html',
  imports: [SafePipe],
})
export class HandDragGhostComponent {
  protected readonly drag = inject(HandDragService);

  /** Whether a card is being carried, either out of your own hand or drawn from someone else's. */
  protected carrying(): boolean {
    return this.drag.card() !== null || this.drag.drawCard() !== null;
  }

  /** Your own card shows its front; a card being drawn shows only what the hand overview showed of it. */
  protected imageUrl(): string {
    const own = this.drag.card();
    if (own) return own.frontImage?.url ?? '';
    return this.drag.drawImageUrl();
  }
}
