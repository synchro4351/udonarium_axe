import type { AgentObjectSchema, AgentSchema } from '@axe/core/agent/agent-schema';
import type { AgentToolDefinition } from '@axe/core/agent/agent-tools';

/*
 * The tools that help build the table: new tables, map masks laid out in a grid, and notes. Kept in
 * a file of their own, listed after the room-reading ones.
 */

function input(properties: Record<string, AgentSchema>, required: readonly string[] = []): AgentObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const COL: AgentSchema = {
  type: 'integer',
  description: 'Column of the square, counted from 1 at the west (left) edge of the table.',
  minimum: 1,
};

const ROW: AgentSchema = {
  type: 'integer',
  description: 'Row of the square, counted from 1 at the north (top) edge of the table.',
  minimum: 1,
};

const CELLS: AgentSchema = { type: 'integer', minimum: 1, maximum: 200 };

const NOTE: AgentSchema = { type: 'string', description: 'A note, by its title or id.', minLength: 1 };

const TABLE: AgentSchema = {
  type: 'string',
  description: 'A table, by name or id (see get_room); the one in view where left out.',
  minLength: 1,
};

export const BUILD_AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'create_table',
    title: 'Make a table',
    access: 'gm',
    description:
      'Make a new table, its size in squares, its grid shown or not, and a picture of the room’s on its floor (by ' +
      'name or id, see list_assets with kind images). It is not shown to anyone until switch_table switches to it. ' +
      'Returns its id.',
    input: input(
      {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        width: CELLS,
        height: CELLS,
        grid: { type: 'boolean', description: 'Show the grid. On where left out.' },
        image: { type: 'string', description: 'The picture laid on the floor.', minLength: 1 },
      },
      ['name', 'width', 'height']
    ),
  },
  {
    name: 'place_masks',
    title: 'Lay map masks in a grid',
    access: 'gm',
    description:
      'Cover an area of the table in view with map masks, cut into a grid of masks each `size` squares across, so ' +
      'that each can be taken off on its own as the players explore. Up to 400 masks at once. Returns how many.',
    input: input(
      {
        col: COL,
        row: ROW,
        width: { ...CELLS, description: 'How many squares across the area is.' },
        height: { ...CELLS, description: 'How many squares down.' },
        size: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'How many squares each mask covers. One where left out.',
        },
        name: {
          type: 'string',
          maxLength: 60,
          description: 'What the masks are called; each gets its place after it.',
        },
        colour: { type: 'string', description: 'A CSS colour, such as #202020.' },
        opacity: {
          type: 'integer',
          minimum: 0,
          maximum: 100,
          description: 'How opaque, 0 to 100. 100 where left out.',
        },
        table: TABLE,
      },
      ['col', 'row', 'width', 'height']
    ),
  },
  {
    name: 'remove_masks',
    title: 'Take map masks off',
    access: 'gm',
    destructive: true,
    description:
      'Take off the map masks of the table in view that lie within an area of squares, as the players uncover it, ' +
      'or those of a name. Returns how many went.',
    input: input({
      col: COL,
      row: ROW,
      width: CELLS,
      height: CELLS,
      name: { type: 'string', description: 'Only the masks whose name starts with this.', maxLength: 60 },
      table: TABLE,
    }),
  },
  {
    name: 'scratch_masks',
    title: 'Scratch map masks open',
    access: 'gm',
    description:
      'Scratch open the squares of an area on the map masks of a table, as the scratch of a mask does, so the ' +
      'players see through those squares while the mask stays; or cover them again with open false. Suits a ' +
      'mask laid as one piece. Returns how many squares changed.',
    input: input(
      {
        col: COL,
        row: ROW,
        width: CELLS,
        height: CELLS,
        open: { type: 'boolean', description: 'Open the squares; false covers them again. Open where left out.' },
        table: TABLE,
      },
      ['col', 'row', 'width', 'height']
    ),
  },
  {
    name: 'remove_table',
    title: 'Throw a table away',
    access: 'gm',
    destructive: true,
    description: 'Throw away a table that is not in view, with everything on it.',
    input: input({ table: { ...TABLE, description: 'The table, by name or id.' } }, ['table']),
  },
  {
    name: 'remove_deck',
    title: 'Throw a deck away',
    access: 'gm',
    destructive: true,
    description: 'Throw away a deck on the table, with the cards in it (see list_assets or the table for its name).',
    input: input({ deck: { type: 'string', description: 'The deck, by name or id.', minLength: 1 } }, ['deck']),
  },
  {
    name: 'turn_piece',
    title: 'Turn a piece or lay it down',
    access: 'write',
    description:
      'Turn a piece to face a way, in degrees clockwise from facing up the table, or lay it down on its back and ' +
      'stand it up again, as its handles on the table do.',
    input: input(
      {
        piece: { type: 'string', description: 'A piece, by name or id.', minLength: 1 },
        facing: { type: 'number', minimum: -360, maximum: 360, description: 'Degrees clockwise.' },
        lying: { type: 'boolean', description: 'Lay it down, or stand it up with false.' },
      },
      ['piece']
    ),
  },
  {
    name: 'set_note_visibility',
    title: 'Show a note or keep it back',
    access: 'write',
    description:
      'Let everyone read a note on the table, or keep it to the game master and its owner, as the menu of a ' +
      'note does.',
    input: input({ note: NOTE, visible: { type: 'boolean' } }, ['note', 'visible']),
  },
  {
    name: 'list_notes',
    title: 'Read the notes',
    access: 'read',
    description: 'List the notes on the table this seat may read, with their titles and text.',
    input: input({}),
  },
  {
    name: 'place_note',
    title: 'Put a note on the table',
    access: 'write',
    description:
      'Put a note on the table in view, at a square: a handout, a list of what is known, a progress chart. ' +
      'Formatted notes draw # headings, - lists and > quotes. Everyone may read it unless hidden keeps it to the ' +
      'game master and its owner.',
    input: input(
      {
        title: { type: 'string', minLength: 1, maxLength: 100 },
        text: { type: 'string', maxLength: 10000 },
        col: COL,
        row: ROW,
        width: { type: 'integer', minimum: 1, maximum: 24 },
        height: { type: 'integer', minimum: 1, maximum: 24 },
        formatted: { type: 'boolean' },
        hidden: { type: 'boolean', description: 'Keep it to the game master and its owner, as a note put by hand is.' },
      },
      ['title', 'text']
    ),
  },
  {
    name: 'edit_note',
    title: 'Rewrite a note',
    access: 'write',
    description: 'Rewrite a note on the table: its title, its text, or add lines to the end of its text.',
    input: input(
      {
        note: NOTE,
        title: { type: 'string', minLength: 1, maxLength: 100 },
        text: { type: 'string', maxLength: 10000, description: 'The whole text, in place of what it holds.' },
        append: { type: 'string', maxLength: 2000, description: 'Lines added to the end.' },
      },
      ['note']
    ),
  },
];
