import { getPeerContext, getPeerContexts } from '@axe/core/network/peer-context-source';
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

  get width(): number {
    return this.getCommonValue('width', 1);
  }
  get height(): number {
    return this.getCommonValue('height', 1);
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

  get color(): string {
    const element = this.getElement('color', this.commonDataElement);
    return element ? `${element.value}` : '#555555';
  }
  set color(color: string) {
    const element = this.getElement('color', this.commonDataElement);
    if (element) element.value = color;
    else
      this.commonDataElement?.appendChild(
        DataElement.create('color', color, { type: 'colors', currentValue: '#0a0a0a' }, `color_${this.identifier}`)
      );
  }

  get bgcolor(): string {
    const element = this.getElement('color', this.commonDataElement);
    return element ? `${element.currentValue}` : '#0a0a0a';
  }
  set bgcolor(bgcolor: string) {
    const element = this.getElement('color', this.commonDataElement);
    if (element) element.currentValue = bgcolor;
    else
      this.commonDataElement?.appendChild(
        DataElement.create('color', '#555555', { type: 'colors', currentValue: bgcolor }, `color_${this.identifier}`)
      );
  }

  get ownerName(): string {
    const object = PeerCursor.findByUserId(this.owner);
    return object ? object.name : '';
  }

  get ownerColor(): string {
    return '#444444';
  }

  get hasOwner(): boolean {
    return this.owner.length > 0;
  }
  get ownerIsOnline(): boolean {
    return this.isOwnerOnline(getPeerContext(), getPeerContexts());
  }
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

  get isMine(): boolean {
    return this.isOwnedBy(getPeerContext().userId);
  }
  isOwnedBy(userId: string): boolean {
    return userId === this.owner;
  }

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
