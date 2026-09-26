import { SyncObject, SyncVar } from '@axe/core/sync/decorator';
import { ObjectNode } from '@axe/core/sync/object-node';

/** The emoji offered first when a reader reacts to a line. */
export const DEFAULT_REACTION_EMOJIS: readonly string[] = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '😢',
  '🙏',
  '🎉',
  '👀',
  '🤔',
  '👏',
  '🔥',
  '✅',
];

/** How many different emoji one reader may leave on one line. */
export const MAX_REACTIONS_PER_READER = 20;

const MAX_EMOJI_LENGTH = 32;
const PICTOGRAPHIC = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const WHITESPACE = /\s/u;

/**
 * Whether a string can stand as a reaction: one short run of emoji with no spaces or letters of
 * the alphabet, so a reaction written by hand or by a stranger's build cannot carry text.
 */
export function isReactionEmoji(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_EMOJI_LENGTH) return false;
  if (WHITESPACE.test(value) || /[\p{L}\p{N}]/u.test(value.replace(/[#*0-9]️?⃣/gu, ''))) return false;
  return PICTOGRAPHIC.test(value) || /⃣/u.test(value);
}

/**
 * The reactions one reader left on one chat line.
 *
 * Every reader keeps their own node under the line and only ever writes to that one. Sync settles a
 * clash by keeping the whole of whichever copy is newer, so were the reactions kept on the line
 * itself, two readers reacting at once would have one of them lost; kept apart like this, no two
 * readers ever write to the same object. Deleting the line deletes the nodes beneath it.
 */
@SyncObject('chat-reaction')
export class ChatReaction extends ObjectNode {
  /** The user id of the reader whose reactions these are. */
  @SyncVar() owner: string;
  /** The emoji, in the order they were left, separated by spaces. */
  @SyncVar() emojiList: string;

  /** The emoji this reader left, in the order they were left, leaving out anything that is not one. */
  get emojis(): string[] {
    const raw = typeof this.emojiList === 'string' ? this.emojiList : '';
    const seen = new Set<string>();
    for (const emoji of raw.split(' ')) {
      if (isReactionEmoji(emoji)) seen.add(emoji);
    }
    return [...seen].slice(0, MAX_REACTIONS_PER_READER);
  }

  /** Whether this reader left the emoji. */
  has(emoji: string): boolean {
    return this.emojis.includes(emoji);
  }

  /**
   * Leaves the emoji, or takes it back when already left. Answers whether it is now left.
   *
   * An emoji that is not one, or one past the limit a reader may leave, changes nothing.
   */
  toggle(emoji: string): boolean {
    if (!isReactionEmoji(emoji)) return false;
    const emojis = this.emojis;
    const index = emojis.indexOf(emoji);
    if (index >= 0) {
      emojis.splice(index, 1);
    } else {
      if (emojis.length >= MAX_REACTIONS_PER_READER) return false;
      emojis.push(emoji);
    }
    this.emojiList = emojis.join(' ');
    return index < 0;
  }
}

/** One emoji left on a line, with how many readers left it and whether the reader is one of them. */
export interface ChatReactionCount {
  readonly emoji: string;
  readonly count: number;
  readonly mine: boolean;
}

/**
 * Counts the reactions on a line, one vote per reader for each emoji.
 *
 * Emoji come in the order they first appear, going through the readers in the order given, so
 * every seat lists them alike. A reader found twice, as when two windows of theirs both reacted
 * before hearing of each other, still counts once. `me` marks the reader's own.
 */
export function tallyReactions(
  votes: readonly { readonly owner: string; readonly emojis: readonly string[] }[],
  me?: string
): ChatReactionCount[] {
  const voters = new Map<string, Set<string>>();
  for (const vote of votes) {
    if (!vote.owner) continue;
    for (const emoji of vote.emojis) {
      let owners = voters.get(emoji);
      if (!owners) {
        owners = new Set();
        voters.set(emoji, owners);
      }
      owners.add(vote.owner);
    }
  }
  return [...voters].map(([emoji, owners]) => ({
    emoji,
    count: owners.size,
    mine: me != null && me.length > 0 && owners.has(me),
  }));
}

/** The counts as one short line, such as `👍 2・❤️ 1`, for a log. Empty when nobody reacted. */
export function formatReactionSummary(reactions: readonly ChatReactionCount[] | undefined): string {
  return (reactions ?? [])
    .filter((reaction) => reaction.count > 0)
    .map((reaction) => `${reaction.emoji} ${reaction.count}`)
    .join('・');
}
