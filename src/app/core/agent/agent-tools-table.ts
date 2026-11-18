import type { AgentObjectSchema, AgentSchema } from '@axe/core/agent/agent-schema';
import type { AgentToolDefinition } from '@axe/core/agent/agent-tools';

/*
 * The tools for setting the table up in plain words: the turn order and the inventory's order,
 * alarms, votes and stamps. Kept in a file of their own, listed after the room-reading ones.
 */

function input(properties: Record<string, AgentSchema>, required: readonly string[] = []): AgentObjectSchema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const SEATS: AgentSchema = {
  type: 'array',
  description: "Seats' names. Leave out for everyone in the room, this seat included.",
  items: { type: 'string', minLength: 1 },
  maxItems: 30,
};

const TAB: AgentSchema = {
  type: 'string',
  description: 'The chat tab, by name or id. Leave out for the tab this seat has open.',
  minLength: 1,
};

const ORDER: AgentSchema = { type: 'string', enum: ['ascending', 'descending'] };

export const TABLE_AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'set_turn_order',
    title: 'Set the turn order',
    access: 'write',
    description:
      'Put the pieces in the turn order given, first to last, as after an initiative roll or once the table has agreed. ' +
      "The turn order follows the inventory's sort, so this writes a number into the sheet item the inventory sorts by " +
      '(key, or the one it sorts by now; 行動順 where it sorts by none), highest first, adding the item where a piece ' +
      'lacks it, and sorts the inventory by it, highest first. Pieces left out keep their values. Needs each sheet open.',
    input: input(
      {
        pieces: {
          type: 'array',
          description: 'The pieces, first to act first: ids, or names as this seat sees them.',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
          maxItems: 60,
        },
        key: { type: 'string', description: 'The sheet item to write the order into.', minLength: 1, maxLength: 40 },
      },
      ['pieces']
    ),
  },
  {
    name: 'set_inventory_order',
    title: 'Sort the inventory',
    access: 'write',
    description:
      "Sort the room's inventory, and with it the turn order, by a sheet item (such as イニシアティブ), and break ties " +
      'by a second. An empty item sorts by when the pieces were made. Shared with the whole room.',
    input: input(
      {
        by: { type: 'string', description: 'The sheet item to sort by, or empty.', maxLength: 40 },
        order: ORDER,
        then_by: { type: 'string', description: 'The item that breaks ties, or empty.', maxLength: 40 },
        then_order: ORDER,
      },
      ['by', 'order']
    ),
  },
  {
    name: 'set_alarm',
    title: 'Set an alarm',
    access: 'write',
    description:
      'Start a countdown alarm for the seats named, or everyone, as the alarm menu does, and say so in chat. ' +
      'It rings and pops up for them when the time is up.',
    input: input(
      {
        seconds: { type: 'integer', minimum: 1, maximum: 3600 },
        title: { type: 'string', maxLength: 100 },
        to: SEATS,
        sound: { type: 'boolean', description: 'Ring when the time is up. On where left out.' },
        popup: { type: 'boolean', description: 'Pop up when the time is up. On where left out.' },
      },
      ['seconds']
    ),
  },
  {
    name: 'start_vote',
    title: 'Start a vote',
    access: 'write',
    description:
      'Start a vote with the choices given for the seats named, or everyone, or a roll call asking each to say they ' +
      'are ready, as the vote menu does. A secret vote shows the answers only when it closes.',
    input: input({
      title: { type: 'string', maxLength: 100 },
      choices: {
        type: 'array',
        description: 'The choices. Leave out for a roll call.',
        items: { type: 'string', minLength: 1, maxLength: 40 },
        maxItems: 10,
      },
      to: SEATS,
      secret: { type: 'boolean' },
      tab: TAB,
    }),
  },
  {
    name: 'list_stamps',
    title: 'List the stamps',
    access: 'read',
    description: 'List the stamps that can be sent: the built-in ones and the room’s own stamp sets, by name and id.',
    input: input({ name: { type: 'string', description: 'Only those whose name holds this.', maxLength: 40 } }),
  },
  {
    name: 'send_stamp',
    title: 'Send a stamp',
    access: 'write',
    description:
      'Send a stamp into chat as a line of its own, as this seat. Name it by id or by name (see list_stamps).',
    input: input({ stamp: { type: 'string', minLength: 1 }, tab: TAB }, ['stamp']),
  },
];
