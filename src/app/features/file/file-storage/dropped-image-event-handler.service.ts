import { DestroyRef, inject, Injectable } from '@angular/core';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { FileArchiver, ImageDropPlace, SingleFileDropHandler } from '@axe/core/storage/file-archiver';
import { isPasteableImage } from '@axe/features/file/file-storage/clipboard-image';
import { RoomPanelService } from '@axe/features/panels/room-panel.service';

/** Something that holds a dropped picture for the user to look over, such as an open file storage panel. */
export interface DroppedImageHolder {
  /**
   * Holds a picture for confirmation. `returned` marks one a closed panel could not add, brought
   * back so that it is not lost unseen.
   */
  holdDroppedImage(file: File, place: ImageDropPlace | null, returned?: boolean): void;
}

/** A picture left unconfirmed in a panel, and where it was dropped if it was. */
export interface UnconfirmedImage {
  readonly file: File;
  readonly place: ImageDropPlace | null;
}

/** How long a panel opened for a dropped picture has to appear before the drop loads as it used to. */
export const PANEL_OPEN_TIMEOUT_MS = 10_000;

/**
 * Takes a single picture dropped on the page to the file storage panel to be looked over, as a
 * pasted one is, instead of storing it at once. The panel is opened for it when none is.
 *
 * Several files, other kinds of file, a picture the preview cannot show, and any drop by a seat that
 * may not edit the table are left to load as they always have, as is a drop the panel could not be
 * opened for.
 *
 * A panel closed with a picture still unconfirmed hands it back here to be added, since only
 * cancelling it throws it away; one that cannot be added is brought back in the panel.
 */
@Injectable({ providedIn: 'root' })
export class DroppedImageEventHandlerService {
  private readonly fileArchiver = inject(FileArchiver);
  private readonly rolePermission = inject(RolePermissionService);
  private readonly roomPanels = inject(RoomPanelService);

  private readonly holders: DroppedImageHolder[] = [];
  /**
   * Pictures waiting for a panel: those dropped while it was opening, and those a closed panel
   * could not add.
   */
  private waiting: (UnconfirmedImage & { readonly returned: boolean })[] = [];
  /** Set while a panel opened from here has yet to appear. */
  private openTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const handler: SingleFileDropHandler = (file, place) => this.take(file, place);
    this.fileArchiver.singleFileDropHandler = handler;
    inject(DestroyRef).onDestroy(() => {
      if (this.fileArchiver.singleFileDropHandler === handler) this.fileArchiver.singleFileDropHandler = null;
      this.stopWaitingForPanel();
    });
  }

  /**
   * Lets an open panel take dropped pictures, handing it at once any waiting for one. The panel
   * most recently opened takes them. Returns the way to let go again when it closes.
   */
  attach(holder: DroppedImageHolder): () => void {
    this.holders.push(holder);
    this.stopWaitingForPanel();
    for (const image of this.waiting.splice(0)) holder.holdDroppedImage(image.file, image.place, image.returned);
    return () => {
      const index = this.holders.indexOf(holder);
      if (index >= 0) this.holders.splice(index, 1);
    };
  }

  /**
   * Adds what a closing panel left unconfirmed, as confirming it would have. Whatever cannot be
   * added is brought back in a panel with a warning rather than thrown away.
   */
  async addUnconfirmed(images: readonly UnconfirmedImage[]): Promise<void> {
    const left: UnconfirmedImage[] = [];
    for (const image of images) {
      if (!(await this.add(image))) left.push(image);
    }
    if (!left.length) return;
    const holder = this.holders.at(-1);
    if (holder) {
      for (const image of left) holder.holdDroppedImage(image.file, image.place, true);
      return;
    }
    this.waiting.push(...left.map((image) => ({ ...image, returned: true })));
    // Kept here until a panel opens, if one cannot be opened now.
    this.openPanel();
  }

  private async add(image: UnconfirmedImage): Promise<boolean> {
    if (!this.rolePermission.canEditTabletop) return false;
    try {
      const { images } = image.place
        ? await this.fileArchiver.loadImages([image.file], image.place)
        : await this.fileArchiver.loadImages([image.file]);
      return images.length > 0;
    } catch {
      return false;
    }
  }

  private take(file: File, place: ImageDropPlace): boolean {
    if (!isPasteableImage(file.type) || !this.rolePermission.canEditTabletop) return false;
    const holder = this.holders.at(-1);
    if (holder) {
      holder.holdDroppedImage(file, place);
      return true;
    }
    // Queue before opening: a panel may attach synchronously and immediately take the drop.
    const waiting = { file, place, returned: false };
    this.waiting.push(waiting);
    if (!this.openPanel()) {
      this.waiting = this.waiting.filter((image) => image !== waiting);
      return false;
    }
    return true;
  }

  /**
   * Opens one panel however many pictures arrive before it is ready. Should it not appear in time,
   * pictures dropped for it load as they used to, and the next drop tries again.
   */
  private openPanel(): boolean {
    if (this.openTimer !== null) return true;
    this.openTimer = setTimeout(() => this.giveUpOnPanel(), PANEL_OPEN_TIMEOUT_MS);
    try {
      this.roomPanels.open('fileStorage');
      return true;
    } catch {
      this.stopWaitingForPanel();
      return false;
    }
  }

  private giveUpOnPanel(): void {
    this.openTimer = null;
    const drops = this.waiting.filter((image) => !image.returned);
    // Pictures a closed panel could not add have already been dropped once; they wait for the next panel.
    this.waiting = this.waiting.filter((image) => image.returned);
    for (const drop of drops) void this.fileArchiver.load([drop.file], drop.place?.point);
  }

  private stopWaitingForPanel(): void {
    if (this.openTimer !== null) clearTimeout(this.openTimer);
    this.openTimer = null;
  }
}
