import { inject, Injectable } from '@angular/core';
import type { AgentHandler } from '@axe/application/agent/agent-tool-runner.service';
import { AgentViews } from '@axe/application/agent/agent-views.service';
import { ImageTagLockService } from '@axe/application/file/image-tag-lock.service';
import { TRANSLATE_FN } from '@axe/application/i18n/translate.token';
import { DisclosureService } from '@axe/application/permission/disclosure.service';
import { RolePermissionService } from '@axe/application/permission/role-permission.service';
import { TabletopService } from '@axe/application/tabletop/tabletop.service';
import { TabletopActionService } from '@axe/application/tabletop/tabletop-action.service';
import { AgentToolError } from '@axe/core/agent/agent-error';
import { ImageFile } from '@axe/core/storage/image-file';
import { ObjectStore } from '@axe/core/sync/object-store';
import { CardStack } from '@axe/domain/card/card-stack';
import { DisclosureMode } from '@axe/domain/disclosure/disclosure';
import { ImageTag } from '@axe/domain/media/image-tag';
import { GameTable } from '@axe/domain/tabletop/game-table';
import { GameTableMask } from '@axe/domain/tabletop/game-table-mask';
import { TextNote } from '@axe/domain/tabletop/text-note';
import { findOne, numberArg, textArg } from '@axe/features/agent-tools/agent-lookup';
import { AgentReadTools } from '@axe/features/agent-tools/agent-read-tools.service';

/** The most masks one call lays. */
const MAX_MASKS = 400;

/**
 * The tools that help build the table: new tables, map masks laid out in a grid, and
 * notes, each made the way the menus make them, as the linked seat.
 */
@Injectable({ providedIn: 'root' })
export class AgentBuildTools {
  private readonly tabletop = inject(TabletopService);
  private readonly actions = inject(TabletopActionService);
  private readonly objectStore = inject(ObjectStore);
  private readonly disclosure = inject(DisclosureService);
  private readonly permission = inject(RolePermissionService);
  private readonly tagLock = inject(ImageTagLockService);
  private readonly t = inject(TRANSLATE_FN);
  private readonly read = inject(AgentReadTools);
  private readonly views = inject(AgentViews);

  readonly handlers: Readonly<Record<string, AgentHandler>> = {
    create_table: (args) => this.createTable(args),
    place_masks: (args) => this.placeMasks(args),
    remove_masks: (args) => this.removeMasks(args),
    list_notes: () => ({ notes: this.notes().map((note) => this.noteView(note)) }),
    place_note: (args) => this.placeNote(args),
    edit_note: (args) => this.editNote(args),
    scratch_masks: (args) => this.scratchMasks(args),
    remove_table: (args) => this.removeTable(args),
    remove_deck: (args) => this.removeDeck(args),
    turn_piece: (args) => this.turnPiece(args),
    set_note_visibility: (args) => {
      const note = this.note(textArg(args, 'note'));
      if (!this.disclosure.canEdit(note)) {
        throw new AgentToolError('not_allowed', `This seat may not change who reads ${note.title}.`);
      }
      note.disclosureMode = args['visible'] === true ? DisclosureMode.All : DisclosureMode.GameMaster;
      note.update();
      return this.noteView(note);
    },
  };

  /** A table by name or id, or the one in view where none is named. */
  private tableOf(args: Readonly<Record<string, unknown>>): GameTable {
    const reference = textArg(args, 'table').trim();
    if (!reference) {
      const table = this.tabletop.currentTable;
      if (!table) throw new AgentToolError('failed', 'No table is in view.');
      return table;
    }
    return findOne(
      this.objectStore.getObjects<GameTable>(GameTable),
      reference,
      (table) => table.identifier,
      (table) => table.name,
      'table'
    );
  }

  private scratchMasks(args: Readonly<Record<string, unknown>>): unknown {
    const table = this.tableOf(args);
    const grid = table.gridSize || this.tabletop.gridSize();
    const left = Math.floor(numberArg(args, 'col', 1)) - 1;
    const top = Math.floor(numberArg(args, 'row', 1)) - 1;
    const right = left + Math.floor(numberArg(args, 'width', 1));
    const bottom = top + Math.floor(numberArg(args, 'height', 1));
    const open = args['open'] !== false;
    let changed = 0;
    for (const mask of table.masks) {
      const maskCol = Math.round(mask.location.x / grid);
      const maskRow = Math.round(mask.location.y / grid);
      const cells = new Set(mask.scratchedGrids ? mask.scratchedGrids.split(',').filter(Boolean) : []);
      const before = cells.size;
      for (let col = Math.max(left, maskCol); col < Math.min(right, maskCol + mask.width); col++) {
        for (let row = Math.max(top, maskRow); row < Math.min(bottom, maskRow + mask.height); row++) {
          const key = `${col - maskCol}:${row - maskRow}`;
          if (open) cells.add(key);
          else cells.delete(key);
        }
      }
      if (cells.size === before) continue;
      changed += Math.abs(cells.size - before);
      mask.scratchedGrids = [...cells].sort().join(',');
      mask.update();
    }
    return { changed };
  }

  private removeTable(args: Readonly<Record<string, unknown>>): unknown {
    const table = this.tableOf(args);
    if (table === this.tabletop.currentTable) {
      throw new AgentToolError('invalid_input', 'The table in view cannot be thrown away; switch to another first.');
    }
    const name = table.name;
    table.destroy();
    return { removed: name };
  }

  private removeDeck(args: Readonly<Record<string, unknown>>): unknown {
    const deck = findOne(
      this.objectStore.getObjects<CardStack>(CardStack).filter((stack) => stack.location.name === 'table'),
      textArg(args, 'deck'),
      (stack) => stack.identifier,
      (stack) => stack.name,
      'deck'
    );
    const name = deck.name;
    const count = deck.cards.length;
    deck.destroy();
    return { removed: name, cards: count };
  }

  private turnPiece(args: Readonly<Record<string, unknown>>): unknown {
    const piece = this.read.piece(textArg(args, 'piece'));
    if (!this.views.sheetOpen(piece)) {
      throw new AgentToolError('not_allowed', `This seat may not move ${this.views.nameOf(piece)}.`);
    }
    if (typeof args['facing'] === 'number') piece.rotate = ((args['facing'] % 360) + 360) % 360;
    if (typeof args['lying'] === 'boolean') piece.roll = args['lying'] ? 90 : 0;
    piece.update();
    return { piece: this.views.nameOf(piece), facing: piece.rotate, lying: piece.roll !== 0 };
  }

  private createTable(args: Readonly<Record<string, unknown>>): unknown {
    const table = new GameTable();
    table.name = textArg(args, 'name').trim();
    table.width = Math.floor(numberArg(args, 'width', 20));
    table.height = Math.floor(numberArg(args, 'height', 15));
    table.gridShow = args['grid'] !== false;
    table.imageIdentifier = textArg(args, 'image').trim()
      ? this.image(textArg(args, 'image')).identifier
      : ImageFile.Empty.identifier;
    table.initialize();
    return { table: { id: table.identifier, name: table.name, width: table.width, height: table.height } };
  }

  private placeMasks(args: Readonly<Record<string, unknown>>): unknown {
    const table = this.tableOf(args);
    const grid = table.gridSize || this.tabletop.gridSize();
    const col = Math.floor(numberArg(args, 'col', 1));
    const row = Math.floor(numberArg(args, 'row', 1));
    const width = Math.floor(numberArg(args, 'width', 1));
    const height = Math.floor(numberArg(args, 'height', 1));
    const size = Math.max(1, Math.floor(numberArg(args, 'size', 1)));
    const across = Math.ceil(width / size);
    const down = Math.ceil(height / size);
    if (across * down > MAX_MASKS) {
      throw new AgentToolError(
        'invalid_input',
        `That makes ${across * down} masks; lay at most ${MAX_MASKS} at once, or make each one larger with size.`
      );
    }
    const name = textArg(args, 'name').trim() || this.t('feature.tabletop.action.defaultMaskName');
    const colour = textArg(args, 'colour').trim();
    const opacity = Math.floor(numberArg(args, 'opacity', 100));
    for (let y = 0; y < down; y++) {
      for (let x = 0; x < across; x++) {
        const w = Math.min(size, width - x * size);
        const h = Math.min(size, height - y * size);
        const mask = GameTableMask.create(`${name} ${col + x * size}-${row + y * size}`, w, h, opacity);
        mask.location.x = (col - 1 + x * size) * grid;
        mask.location.y = (row - 1 + y * size) * grid;
        if (colour) mask.paintColor(colour);
        table.appendChild(mask);
      }
    }
    return { masks: across * down, across, down };
  }

  private removeMasks(args: Readonly<Record<string, unknown>>): unknown {
    const table = this.tableOf(args);
    const grid = table.gridSize || this.tabletop.gridSize();
    const prefix = textArg(args, 'name').trim();
    const hasArea = typeof args['col'] === 'number' && typeof args['row'] === 'number';
    if (!hasArea && !prefix) throw new AgentToolError('invalid_input', 'Give an area of squares, a name, or both.');
    const left = (numberArg(args, 'col', 1) - 1) * grid;
    const top = (numberArg(args, 'row', 1) - 1) * grid;
    const right = left + numberArg(args, 'width', 1) * grid;
    const bottom = top + numberArg(args, 'height', 1) * grid;
    const masks = table.masks.filter((mask) => {
      if (prefix && !mask.name.startsWith(prefix)) return false;
      if (!hasArea) return true;
      const x = mask.location.x;
      const y = mask.location.y;
      return x >= left && y >= top && x + mask.width * grid <= right && y + mask.height * grid <= bottom;
    });
    for (const mask of masks) mask.destroy();
    return { removed: masks.length };
  }

  private notes(): TextNote[] {
    return this.objectStore
      .getObjects<TextNote>(TextNote)
      .filter((note) => note.location.name === 'table' && this.disclosure.canView(note));
  }

  private note(reference: string): TextNote {
    return findOne(
      this.notes(),
      reference,
      (note) => note.identifier,
      (note) => note.title,
      'note'
    );
  }

  private noteView(note: TextNote): unknown {
    return { id: note.identifier, title: note.title, text: note.text, formatted: note.isFormatted };
  }

  private placeNote(args: Readonly<Record<string, unknown>>): unknown {
    const grid = this.tabletop.gridSize();
    const point = {
      x: (numberArg(args, 'col', 1) - 1) * grid,
      y: (numberArg(args, 'row', 1) - 1) * grid,
      z: 0,
    };
    const note = this.actions.createTextNote(point);
    this.writeCommon(note, 'title', textArg(args, 'title').trim());
    note.text = textArg(args, 'text');
    if (typeof args['width'] === 'number') this.writeCommon(note, 'width', Math.floor(args['width']));
    if (typeof args['height'] === 'number') this.writeCommon(note, 'height', Math.floor(args['height']));
    if (args['formatted'] === true) note.isFormatted = true;
    // A note the AI puts is for the table to read, unless it is asked to keep it back.
    if (args['hidden'] !== true) note.disclosureMode = DisclosureMode.All;
    note.update();
    return this.noteView(note);
  }

  private editNote(args: Readonly<Record<string, unknown>>): unknown {
    const note = this.note(textArg(args, 'note'));
    if (typeof args['title'] === 'string') this.writeCommon(note, 'title', args['title'].trim());
    if (typeof args['text'] === 'string') note.text = args['text'];
    if (typeof args['append'] === 'string') note.text = note.text ? `${note.text}\n${args['append']}` : args['append'];
    return this.noteView(note);
  }

  private writeCommon(note: TextNote, name: string, value: string | number): void {
    const element = note.commonDataElement?.getFirstElementByName(name);
    if (element) element.value = value;
  }

  private image(reference: string): ImageFile {
    // The pictures this seat may pick, as list_assets lists them.
    const images = ImageTag.searchImages([], this.tagLock.sight());
    return findOne(
      images,
      reference,
      (image) => image.identifier,
      (image) => image.name,
      'picture'
    );
  }
}
