import type { AgentObjectSchema, AgentSchema } from '@axe/core/agent/agent-schema';
import type { AgentToolDefinition } from '@axe/core/agent/agent-tools';

/*
 * The tool for hotbars. A hotbar is each player's own, so the AI does not set anyone's up: it hands a
 * page of slots round the chat as a template, and each player who wants it takes it onto their own bar
 * with a button under the line.
 */

/** What the slots a template holds can do, as the AI names them. */
export const OFFER_SLOT_KINDS = ['chat', 'prefill', 'effect', 'sound', 'cut_in', 'turn', 'sheet', 'group'] as const;

/** The icons a slot may wear; kept in step with the slot editor's (`HOTBAR_ICONS`). */
const ICONS = [
  'chat_bubble',
  'casino',
  'auto_awesome',
  'radar',
  'add_circle',
  'favorite',
  'bolt',
  'shield',
  'local_fire_department',
  'healing',
  'volume_up',
  'slideshow',
  'person',
  'article',
  'my_location',
  'skip_next',
  'star',
  'flag',
];

function input(properties: Record<string, AgentSchema>, required: readonly string[] = []): AgentObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const SLOT_NUMBER: AgentSchema = { type: 'integer', minimum: 1, maximum: 10 };

const SLOT: AgentSchema = input(
  {
    slot: { ...SLOT_NUMBER, description: 'Where on the page, 1 to 10, as the keys 1 to 0 press them.' },
    kind: {
      type: 'string',
      enum: [...OFFER_SLOT_KINDS],
      description:
        'chat: says `text` as the character the player speaks as (dice, palette references and 《effect》 work as ' +
        'in the chat box, but a line rolls only its first dice, so give each roll a slot of its own); prefill: writes `text` into the chat box for the player to finish; effect: casts the ' +
        'effect `name` from the piece; sound: plays the sound effect `name` for everyone; cut_in: plays the cut-in ' +
        '`name`; turn: moves the turn (`turn`); sheet: opens the character sheet; group: runs the slots in `steps` ' +
        'one after another.',
    },
    text: { type: 'string', maxLength: 2000, description: 'The line, for chat and prefill. \\n starts a new line.' },
    name: { type: 'string', maxLength: 200, description: 'The effect, sound effect or cut-in, by name or id.' },
    turn: { type: 'string', enum: ['next', 'prev', 'reset'] },
    steps: {
      type: 'array',
      items: SLOT_NUMBER,
      minItems: 1,
      maxItems: 9,
      description: 'For a group: the slots of this template it runs, in order. A group does not run a group.',
    },
    wait_ms: {
      type: 'integer',
      minimum: 0,
      maximum: 10000,
      description: 'For a group: how long to wait before each step after the first. None where left out.',
    },
    label: { type: 'string', maxLength: 20, description: 'The few words shown on the slot.' },
    icon: { type: 'string', enum: ICONS },
    color: { type: 'string', description: 'A CSS colour for the slot, such as #c0392b.' },
  },
  ['slot', 'kind']
);

export const HOTBAR_AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'offer_hotbar',
    title: 'Hand a hotbar page round',
    access: 'write',
    description:
      'Put a page of hotbar slots in the chat as a template that each player may take onto their own hotbar with ' +
      'a button under the line, when a player asks for one or the scenario wants one, such as a spell: the ' +
      'chant said in chat, the attack from the palette, the effect cast, and a group running the three. The ' +
      'slots act as whoever the player who takes it speaks as. Nobody’s hotbar changes until they take it.',
    input: input(
      {
        title: { type: 'string', minLength: 1, maxLength: 60, description: 'What the page is for.' },
        tab: { type: 'string', description: 'The chat tab, by name or id; the one open where left out.' },
        slots: { type: 'array', items: SLOT, minItems: 1, maxItems: 10 },
      },
      ['title', 'slots']
    ),
  },
];
