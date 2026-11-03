import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PanelDockService } from '@axe/application/ui/panel-dock.service';
import { Z_PANEL_DOCK_PREVIEW } from '@axe/ui/z-layers';

/** Shows where a panel being dragged to the side of the screen would dock if let go of now. */
@Component({
  selector: 'app-panel-dock-preview',
  templateUrl: './panel-dock-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelDockPreviewComponent {
  protected readonly preview = inject(PanelDockService).preview;
  protected readonly layer = Z_PANEL_DOCK_PREVIEW;
}
