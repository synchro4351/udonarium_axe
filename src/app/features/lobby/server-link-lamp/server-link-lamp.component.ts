import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NetworkEventHandlerService } from '@axe/features/lobby/network-event-handler.service';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * A small lamp lit while the link to the room server is down and being tried again (tyoitashi), so
 * a drop that comes back within seconds is seen without a notice over the table.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'server-link-lamp',
  templateUrl: './server-link-lamp.component.html',
  host: { class: 'contents' },
  imports: [TranslocoModule],
})
export class ServerLinkLampComponent {
  protected readonly down = inject(NetworkEventHandlerService).serverLinkDown;
}
