import { DestroyRef, inject, Injectable } from '@angular/core';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { ObjectChangeService } from '@axe/application/sync/object-change.service';
import { MenuLayoutService } from '@axe/application/ui/menu-layout.service';
import { SnackbarService } from '@axe/application/ui/snackbar.service';
import { parseMenuLayoutFile } from '@axe/domain/ui/menu-layout-file';

/**
 * Takes an arrangement of the menus dropped on the page, as the menu editor's 読み込む does, so a
 * file made in an outside tool needs no trip through the editor. Any other JSON is left alone.
 */
@Injectable({ providedIn: 'root' })
export class MenuFileDropHandlerService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectChange = inject(ObjectChangeService);
  private readonly layouts = inject(MenuLayoutService);
  private readonly snackbar = inject(SnackbarService);
  private readonly t = inject(TRANSLATE_FN);

  constructor() {
    this.objectChange.jsonLoaded$.subscribe((event) => {
      const layouts = parseMenuLayoutFile(event.text);
      if (!layouts) return;
      this.layouts.adopt(layouts);
      this.snackbar.show(this.t('feature.menuEditor.dropped', { name: event.name }));
    }, this.destroyRef);
  }
}
