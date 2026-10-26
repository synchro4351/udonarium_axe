/** An entry of the selector as ng-select hands it to a search. */
export interface DiceBotSearchItem {
  $ngOptionValue?: unknown;
  value?: unknown;
}

/** What the dice bot selector knows of a game system. */
export interface DiceBotSearchInfo {
  id: string;
  name: string;
  sortKey?: string;
}

const VOWEL_OF: Record<string, string> = {};
for (const [vowel, row] of Object.entries({
  あ: 'あかさたなはまやらわがざだばぱゃぁ',
  い: 'いきしちにひみりぎじぢびぴぃ',
  う: 'うくすつぬふむゆるぐずづぶぷゅぅっ',
  え: 'えけせてねへめれげぜでべぺぇ',
  お: 'おこそとのほもよろをごぞどぼぽょぉ',
})) {
  for (const kana of row) VOWEL_OF[kana] = vowel;
}

/**
 * Text as BCDice writes a game system's reading: hiragana, without voiced marks, a long vowel mark
 * spelt as the vowel it lengthens, lower case, and no spaces or middle dots. Typed text is put the
 * same way, so that 「ソードワールド」「そーどわーるど」 and the reading 「そおとわあると」 meet.
 */
export function normalizeDiceBotText(text: string): string {
  const hiragana = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize('NFD')
    .replace(/[゙゚]/g, '')
    .normalize('NFC')
    .replace(/[\s・･·.,、。_-]/g, '');
  let out = '';
  for (const c of hiragana) out += c === 'ー' ? (VOWEL_OF[out.at(-1) ?? ''] ?? '') : c;
  return out;
}

/** The game system's id cut down to its capitals and digits, as people shorten it: SwordWorld2.5 → sw25. */
function idInitials(id: string): string {
  return normalizeDiceBotText(id.replace(/[a-z]/g, ''));
}

/**
 * A search for the dice bot selector that finds a game system by any part of its name, its reading
 * or its id, or by its id's initials, ignoring kana, voiced marks, long vowel marks, case and dots.
 * Built once for a list, it gives the ng-select search function; an `<ng-option>` item carries the
 * id as `$ngOptionValue`, one from `[items]` as `value`.
 */
export function diceBotSearch(infos: readonly DiceBotSearchInfo[]): (term: string, item: DiceBotSearchItem) => boolean {
  const keys = new Map<string, string[]>();
  for (const info of infos) {
    keys.set(info.id, [
      normalizeDiceBotText(info.name),
      normalizeDiceBotText(info.sortKey ?? ''),
      normalizeDiceBotText(info.id),
      idInitials(info.id),
    ]);
  }
  return (term, item) => {
    const wanted = normalizeDiceBotText(term);
    if (!wanted) return true;
    const found = keys.get(String(item.$ngOptionValue ?? item.value ?? ''));
    return found ? found.some((key) => key.includes(wanted)) : false;
  };
}

const searches = new WeakMap<readonly DiceBotSearchInfo[], ReturnType<typeof diceBotSearch>>();

/** The search for this very list, built once for it, as the selector asks it once per entry and keystroke. */
export function diceBotSearchFor(infos: readonly DiceBotSearchInfo[]): ReturnType<typeof diceBotSearch> {
  let search = searches.get(infos);
  if (!search) {
    search = diceBotSearch(infos);
    searches.set(infos, search);
  }
  return search;
}
