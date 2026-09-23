import { getPeerContext, getPeerContexts } from '@axe/core/network/peer-context-source';
import { ImageFile } from '@axe/core/storage/image-file';
import { ImageStorage } from '@axe/core/storage/image-storage';
import { SyncObject, SyncVar } from '@axe/core/sync/decorator';
import { DataElement, DataElementType } from '@axe/domain/data/data-element';
import { PeerCursor } from '@axe/domain/peer/peer-cursor';
import { appendPieceDataElements } from '@axe/domain/tabletop/piece-data-elements';
import { TabletopObject } from '@axe/domain/tabletop/tabletop-object';

@SyncObject('table-mask')
export class GameTableMask extends TabletopObject {
  static readonly DEFAULT_FONT_SIZE = 18;
  static readonly DEFAULT_OUTLINE_COLOR = '#ffffff';
  @SyncVar() isLock: boolean = false;
  @SyncVar() dispLockMark: boolean = true;

  @SyncVar() owner: string = '';
  @SyncVar() scratchingGrids: string = '';
  @SyncVar() scratchedGrids: string = '';
  //  @SyncVar() isScratchPreviewOnGMMode = false;
  @SyncVar() isPreview = false;

  /**
   * How many grid cells wide the mask is, kept in its common data. Setting it does nothing on a mask
   * without a width element.
   */
  get width(): number {
    return this.getCommonValue('width', 1);
  }
  set width(width: number) {
    this.setCommonValue('width', width);
  }
  /**
   * How many grid cells tall the mask is, kept in its common data. Setting it does nothing on a mask
   * without a height element.
   */
  get height(): number {
    return this.getCommonValue('height', 1);
  }
  set height(height: number) {
    this.setCommonValue('height', height);
  }

  get text(): string {
    return `${this.getElement('text', this.commonDataElement)?.value ?? ''}`;
  }
  set text(value: string) {
    this.setOrCreateTextElement('text', value, { type: DataElementType.NOTE, currentValue: value });
  }

  get fontSize(): number {
    const value = Number(this.getElement('fontsize', this.commonDataElement)?.value);
    return Number.isFinite(value) ? Math.max(1, Math.min(120, Math.round(value))) : GameTableMask.DEFAULT_FONT_SIZE;
  }
  set fontSize(value: number) {
    if (!Number.isFinite(value)) return;
    this.setOrCreateTextElement('fontsize', Math.max(1, Math.min(120, Math.round(value))));
  }

  get textOutline(): boolean {
    const raw = this.getElement('textoutline', this.commonDataElement)?.value;
    return String(raw).toLowerCase() === '1' || String(raw).toLowerCase() === 'true';
  }
  set textOutline(value: boolean) {
    this.setOrCreateTextElement('textoutline', value ? 1 : 0);
  }

  get outlineColor(): string {
    const value = `${this.getElement('outlinecolor', this.commonDataElement)?.value ?? ''}`;
    return /^#[0-9a-f]{6}$/i.test(value) ? value : GameTableMask.DEFAULT_OUTLINE_COLOR;
  }
  set outlineColor(value: string) {
    this.setOrCreateTextElement(
      'outlinecolor',
      /^#[0-9a-f]{6}$/i.test(value) ? value : GameTableMask.DEFAULT_OUTLINE_COLOR
    );
  }

  private setOrCreateTextElement(
    name: string,
    value: string | number,
    attributes: Record<string, string | number> = {}
  ): void {
    const element = this.getElement(name, this.commonDataElement);
    if (element) {
      element.value = value;
      if (name === 'text') element.currentValue = value;
      return;
    }
    this.commonDataElement?.appendChild(DataElement.create(name, value, attributes, `${name}_${this.identifier}`));
  }

  /**
   * Fills the mask with a colour. Text-bearing masks keep their ink colour in the value;
   * otherwise both values follow the upstream fill behaviour.
   *
   * A mask made from the menu carries no colour element; the first colour painted adds one.
   */
  paintColor(color: string): void {
    const element = this.getElement('color', this.commonDataElement);
    if (element) {
      if (!this.text) element.value = color;
      element.currentValue = color;
      return;
    }
    const common = this.commonDataElement;
    if (!common) return;
    common.appendChild(
      DataElement.create(
        'color',
        this.text ? this.color : color,
        { type: 'colors', currentValue: color },
        `color_${this.identifier}`
      )
    );
  }

  /**
   * The colour shown in cells that have been scratched open, in place of the table beneath; empty
   * when there is none, which is also what a mask that never had one reads.
   *
   * It lives in the common data. Setting a colour adds the element when it is missing; setting empty
   * on such a mask adds nothing.
   */
  get scratchedColor(): string {
    return this.optionalText('scratchedColor');
  }
  set scratchedColor(color: string) {
    this.writeOptionalText('scratchedColor', color, 'colors');
  }

  /**
   * The identifier of the picture shown in cells that have been scratched open; empty when there is
   * none.
   *
   * It lives in the common data rather than the image section, which holds the mask's own picture.
   * Setting one adds the element when it is missing; setting empty on such a mask adds nothing.
   */
  get scratchedImageIdentifier(): string {
    return this.optionalText('scratchedImageIdentifier');
  }
  set scratchedImageIdentifier(identifier: string) {
    this.writeOptionalText('scratchedImageIdentifier', identifier, 'image');
  }

  /**
   * The picture shown in cells that have been scratched open, or the empty image when none is set or
   * its file is not in storage.
   */
  get scratchedImageFile(): ImageFile {
    const identifier = this.scratchedImageIdentifier;
    if (identifier.length < 1) return ImageFile.Empty;
    return ImageStorage.instance.get(identifier) ?? ImageFile.Empty;
  }

  private optionalText(name: string): string {
    const element = this.getElement(name, this.commonDataElement);
    if (!element) return '';
    return `${element.value ?? ''}`.trim();
  }

  private writeOptionalText(name: string, value: string, type: string): void {
    const text = value.trim();
    const element = this.getElement(name, this.commonDataElement);
    if (element) {
      element.value = text;
      return;
    }
    const common = this.commonDataElement;
    if (!common || text.length < 1) return;
    common.appendChild(DataElement.create(name, text, { type }, `${name}_${this.identifier}`));
  }

  /**
   * The text colour stored in the colour element's value, compatible with Fly.
   * Setting it creates the element if needed without changing an existing background colour.
   */
  get color(): string {
    const element = this.getElement('color', this.commonDataElement);
    return element ? `${element.value}` : '#ffffff';
  }
  set color(color: string) {
    const element = this.getElement('color', this.commonDataElement);
    if (element) element.value = color;
    else
      this.commonDataElement?.appendChild(
        DataElement.create('color', color, { type: 'colors', currentValue: '#0a0a0a' }, `color_${this.identifier}`)
      );
  }

  /**
   * The fill shown where the mask has no picture, kept as the current value of its colour element;
   * `#0a0a0a` when there is none.
   *
   * Setting it creates the element if needed without changing an existing text colour.
   */
  get bgcolor(): string {
    const element = this.getElement('color', this.commonDataElement);
    return element ? `${element.currentValue}` : '#0a0a0a';
  }
  set bgcolor(bgcolor: string) {
    const element = this.getElement('color', this.commonDataElement);
    if (element) element.currentValue = bgcolor;
    else
      this.commonDataElement?.appendChild(
        DataElement.create('color', '#ffffff', { type: 'colors', currentValue: bgcolor }, `color_${this.identifier}`)
      );
  }

  /**
   * The display name of the user who owns the mask, or empty when nobody does or no peer cursor
   * carries that user.
   */
  get ownerName(): string {
    const object = PeerCursor.findByUserId(this.owner);
    return object ? object.name : '';
  }

  /** The colour of the owner badge, which for a mask is always a dark grey. */
  get ownerColor(): string {
    return '#444444';
  }

  /** Whether some user has claimed the mask. */
  get hasOwner(): boolean {
    return this.owner.length > 0;
  }
  /** Whether the owner is connected right now, judged against this client and its current peers. */
  get ownerIsOnline(): boolean {
    return this.isOwnerOnline(getPeerContext(), getPeerContexts());
  }
  /**
   * Whether the owner is connected, given this client's own context and those of its peers.
   *
   * False when the mask has no owner. Peers are matched to users through their peer cursors.
   */
  isOwnerOnline(
    self: { userId: string; isOpen: boolean },
    peerContexts: { peerId: string; userId?: string; isOpen: boolean }[]
  ): boolean {
    if (!this.hasOwner) return false;
    return (
      (self.userId === this.owner && self.isOpen) ||
      peerContexts.some((context) => {
        const cursor = PeerCursor.findByPeerId(context.peerId);
        return cursor && cursor.userId === this.owner && context.isOpen;
      })
    );
  }

  /** Whether the mask is owned by this client's user. */
  get isMine(): boolean {
    return this.isOwnedBy(getPeerContext().userId);
  }
  /** Whether the mask is owned by the given user id. */
  isOwnedBy(userId: string): boolean {
    return userId === this.owner;
  }

  /**
   * Makes a mask with its name, size and opacity data, and registers it for sync. Without an
   * identifier a new one is generated.
   */
  static create(name: string, width: number, height: number, opacity: number, identifier?: string): GameTableMask {
    let object: GameTableMask;

    if (identifier) {
      object = new GameTableMask(identifier);
    } else {
      object = new GameTableMask();
    }
    object.createDataElements();

    appendPieceDataElements(object, name, { width, height }, opacity);
    object.initialize();

    return object;
  }
}
