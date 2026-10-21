/** What a speaker choice needs to know about a piece. */
export interface SpeakerPiece {
  readonly identifier: string;
  readonly name: string;
  /** The key the linked parts of one creature share; empty for an ordinary piece. */
  readonly partGroup: string;
  readonly partGroupName: string;
  readonly partName: string;
  readonly partGroupImage: string;
}

/** One entry of the speaker list: a piece, or a group of linked parts speaking as a whole. */
export interface SpeakerChoice {
  readonly value: string;
  readonly label: string;
}

/** The start of a choice that speaks for a whole group of linked parts, followed by its key. */
export const WHOLE_GROUP_PREFIX = 'part-group:';

/** The group a choice speaks for as a whole, or null for a choice of one piece. */
export function wholeGroupOf(value: string): string | null {
  return value.startsWith(WHOLE_GROUP_PREFIX) ? value.slice(WHOLE_GROUP_PREFIX.length) : null;
}

function groupNameOf(part: SpeakerPiece): string {
  return part.partGroupName.trim() || part.name;
}

/**
 * The speaker list, with the linked parts of one creature gathered under one entry that speaks
 * for them all, where the first of them stands. A part follows that entry only once it has been
 * spoken as, or while it is the one chosen, so a creature of many parts takes one line until its
 * parts are used.
 */
export function speakerChoices(
  pieces: readonly SpeakerPiece[],
  spokenAs: ReadonlySet<string>,
  chosen: string
): SpeakerChoice[] {
  const choices: SpeakerChoice[] = [];
  const listedGroups = new Set<string>();
  for (const piece of pieces) {
    if (!piece.partGroup) {
      choices.push({ value: piece.identifier, label: piece.name });
      continue;
    }
    if (listedGroups.has(piece.partGroup)) continue;
    listedGroups.add(piece.partGroup);
    const parts = pieces.filter((each) => each.partGroup === piece.partGroup);
    choices.push({ value: WHOLE_GROUP_PREFIX + piece.partGroup, label: groupNameOf(piece) });
    for (const part of parts) {
      if (spokenAs.has(part.identifier) || part.identifier === chosen) {
        choices.push({ value: part.identifier, label: part.name });
      }
    }
  }
  return choices;
}

/** The parts of the group, in the order they stand in the list; the first speaks for the whole. */
export function partsOfGroup<T extends SpeakerPiece>(pieces: readonly T[], group: string): T[] {
  return pieces.filter((piece) => piece.partGroup === group);
}
