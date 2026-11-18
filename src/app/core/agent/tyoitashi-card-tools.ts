import type { AgentObjectSchema, AgentSchema } from '@axe/core/agent/agent-schema';
import type { AgentToolDefinition } from '@axe/core/agent/agent-tools';

/*
 * The tools tyoitashi adds for decks, cards and hands. Kept apart from the official list, which they
 * follow, so that a merge of official changes touches them as little as it can. Adding them changes
 * the tools' digest, so the tab is used with tyoitashi's own build of the bridge.
 */

function input(properties: Record<string, AgentSchema>, required: readonly string[] = []): AgentObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const DECK: AgentSchema = {
  type: 'string',
  description: 'A deck (card stack) on the table: its id, or its name as list_cards shows it.',
  minLength: 1,
};

const CARD: AgentSchema = {
  type: 'string',
  description: 'A card, by the id list_cards gives. A card whose face this seat cannot see is known by its id alone.',
  minLength: 1,
};

const HOLDER: AgentSchema = {
  type: 'string',
  description:
    "Whose hand: a seat's name, or the name of a piece given a hand of its own. Leave out for this seat's own hand.",
  minLength: 1,
};

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

export const TYOITASHI_CARD_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'list_cards',
    title: 'Look at the cards',
    access: 'read',
    description:
      'List the decks on the table in view (name, id, how many cards), the loose cards on it (face up or down, ' +
      'and where), and every hand: whose it is, how many cards it holds, and the cards themselves for the hands ' +
      'this seat may see (its own, the pieces it owns, and any hand shown to everyone). Also says whether the room ' +
      "lets a player draw from or give to another's hand. A face this seat cannot see is never told.",
    input: input({}),
  },
  {
    name: 'draw_card',
    title: 'Draw from a deck',
    access: 'write',
    description:
      "Take cards off the top of a deck into this seat's hand, or into the hand of a piece it owns. The cards go " +
      'face down, seen by the hand’s holder only. Returns the cards drawn as this seat sees them.',
    input: input(
      {
        deck: DECK,
        count: { type: 'integer', minimum: 1, maximum: 60, description: 'How many cards. One where left out.' },
        into: HOLDER,
      },
      ['deck']
    ),
  },
  {
    name: 'deal_cards',
    title: 'Deal a deck out',
    access: 'write',
    description:
      'Shuffle a deck and deal every card out, one at a time in turn, to the hands named, or to every participant ' +
      'where none are named. Extra jokers beyond keep_jokers stay in the deck (one by default, as for Old Maid). ' +
      'Says in chat how many were dealt to how many, never which cards.',
    input: input(
      {
        deck: DECK,
        to: {
          type: 'array',
          description: "The hands to deal to: seats' names, or the names of pieces given a hand.",
          items: { type: 'string', minLength: 1 },
          maxItems: 30,
        },
        keep_jokers: { type: 'integer', minimum: 0, maximum: 10, description: 'How many jokers to deal out.' },
      },
      ['deck']
    ),
  },
  {
    name: 'give_card',
    title: 'Give a card',
    access: 'write',
    description:
      "Give a card to someone else's hand, face down so only they see it: from this seat's hand, from the hand of a " +
      'piece it owns, or from the table. Giving from the table needs the room to allow giving. Chat says who gave ' +
      'whom a card, never which.',
    input: input({ card: CARD, to: { ...HOLDER, description: "The hand to give to: a seat's name, or a piece's." } }, [
      'card',
      'to',
    ]),
  },
  {
    name: 'take_card',
    title: "Draw from someone's hand",
    access: 'write',
    description:
      "Draw a card from another seat's hand into this seat's hand, as in Old Maid, where the room allows it. Name the " +
      'card by id, or leave it out to take one at random. Returns the card as this seat now sees it.',
    input: input(
      { from: { ...HOLDER, description: "The hand to draw from: a seat's name, or a piece's." }, card: CARD },
      ['from']
    ),
  },
  {
    name: 'play_card',
    title: 'Play a card',
    access: 'write',
    description:
      "Put a card from this seat's hand, or a hand of a piece it owns, on the table, face up for all or face down, " +
      'at a square or beside the deck it came from.',
    input: input(
      {
        card: CARD,
        face: { type: 'string', enum: ['up', 'down'], description: 'Face up for everyone (the default), or down.' },
        col: COL,
        row: ROW,
      },
      ['card']
    ),
  },
  {
    name: 'flip_card',
    title: 'Turn a card over',
    access: 'write',
    description: 'Turn a card on the table face up for everyone, or face down.',
    input: input({ card: CARD, face: { type: 'string', enum: ['up', 'down'] } }, ['card', 'face']),
  },
  {
    name: 'shuffle_deck',
    title: 'Shuffle a deck',
    access: 'write',
    description: 'Shuffle a deck on the table.',
    input: input({ deck: DECK }, ['deck']),
  },
];
