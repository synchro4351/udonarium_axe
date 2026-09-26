import { DEFAULT_REACTION_EMOJIS, isReactionEmoji } from '@axe/domain/chat/chat-reaction';

/** An emoji the picker can find by name, with the words it answers to in each language offered. */
interface NamedEmoji {
  readonly emoji: string;
  readonly names: readonly string[];
}

/**
 * The emoji the picker's search knows by name. Kept small on purpose, the ones a table tends to
 * reach for; anything else can still be pasted or typed from the device's own emoji keyboard.
 */
const NAMED_EMOJIS: readonly NamedEmoji[] = [
  { emoji: '👍', names: ['thumbs up', 'like', 'ok', 'good', 'いいね', 'グッド', '좋아요'] },
  { emoji: '👎', names: ['thumbs down', 'dislike', 'bad', 'よくない', 'バッド', '싫어요'] },
  { emoji: '❤️', names: ['heart', 'love', 'red', 'ハート', 'すき', '好き', '하트', '사랑'] },
  { emoji: '😂', names: ['joy', 'laugh', 'lol', 'tears', 'わらい', '笑', '웃음'] },
  { emoji: '🤣', names: ['rofl', 'laugh', 'rolling', 'わらい', '爆笑', '웃음'] },
  { emoji: '😊', names: ['smile', 'happy', 'blush', 'えがお', '笑顔', '미소'] },
  { emoji: '😄', names: ['grin', 'smile', 'happy', 'えがお', '笑顔', '웃음'] },
  { emoji: '😅', names: ['sweat', 'nervous', 'phew', 'あせ', '汗', '苦笑', '땀'] },
  { emoji: '😉', names: ['wink', 'ウインク', '윙크'] },
  { emoji: '😎', names: ['cool', 'sunglasses', 'かっこいい', 'サングラス', '멋짐'] },
  { emoji: '😍', names: ['heart eyes', 'love', 'めろめろ', '好き', '반함'] },
  { emoji: '🥰', names: ['love', 'hearts', 'adore', 'すき', '好き', '사랑'] },
  { emoji: '😮', names: ['wow', 'surprised', 'open mouth', 'おどろき', '驚き', '놀람'] },
  { emoji: '😱', names: ['scream', 'fear', 'shock', 'さけび', '恐怖', '비명'] },
  { emoji: '😢', names: ['cry', 'sad', 'tear', 'なみだ', '涙', '悲しい', '슬픔', '눈물'] },
  { emoji: '😭', names: ['sob', 'cry', 'sad', 'なく', '号泣', '울음'] },
  { emoji: '😡', names: ['angry', 'rage', 'mad', 'いかり', '怒り', '화남'] },
  { emoji: '😤', names: ['huff', 'triumph', 'ふんす', '씩씩'] },
  { emoji: '🤔', names: ['thinking', 'hmm', 'かんがえる', '考える', '생각'] },
  { emoji: '🤯', names: ['mind blown', 'exploding', 'しょうげき', '衝撃', '충격'] },
  { emoji: '😴', names: ['sleep', 'zzz', 'tired', 'ねむい', '眠い', '졸림'] },
  { emoji: '🥺', names: ['pleading', 'please', 'うるうる', 'おねがい', '부탁'] },
  { emoji: '😇', names: ['angel', 'innocent', 'halo', 'てんし', '天使', '천사'] },
  { emoji: '😈', names: ['devil', 'evil', 'smirk', 'あくま', '悪魔', '악마'] },
  { emoji: '💀', names: ['skull', 'dead', 'death', 'どくろ', '死', '해골'] },
  { emoji: '👻', names: ['ghost', 'おばけ', '幽霊', '유령'] },
  { emoji: '🙏', names: ['pray', 'please', 'thanks', 'おねがい', 'ありがとう', '感謝', '감사', '부탁'] },
  { emoji: '👏', names: ['clap', 'applause', 'はくしゅ', '拍手', '박수'] },
  { emoji: '🙌', names: ['raised hands', 'hooray', 'celebrate', 'ばんざい', '万歳', '만세'] },
  { emoji: '👋', names: ['wave', 'hello', 'bye', 'hi', 'やあ', 'バイバイ', '안녕'] },
  { emoji: '✌️', names: ['peace', 'victory', 'ピース', '브이'] },
  { emoji: '👌', names: ['ok', 'okay', 'perfect', 'オーケー', '오케이'] },
  { emoji: '💪', names: ['muscle', 'strong', 'flex', 'ちから', '力', '힘'] },
  { emoji: '🫡', names: ['salute', 'roger', 'りょうかい', '了解', '경례'] },
  { emoji: '👀', names: ['eyes', 'look', 'see', 'め', '目', '見る', '눈'] },
  { emoji: '🎉', names: ['party', 'tada', 'celebrate', 'congrats', 'おめでとう', 'クラッカー', '축하'] },
  { emoji: '🎊', names: ['confetti', 'celebrate', 'くすだま', '축하'] },
  { emoji: '🔥', names: ['fire', 'hot', 'lit', 'ほのお', '炎', '火', '불'] },
  { emoji: '✨', names: ['sparkles', 'shine', 'きらきら', '반짝'] },
  { emoji: '⭐', names: ['star', 'ほし', '星', '별'] },
  { emoji: '💯', names: ['hundred', 'perfect', '100', 'まんてん', '満点', '백점'] },
  { emoji: '✅', names: ['check', 'done', 'yes', 'ok', 'チェック', '完了', '확인'] },
  { emoji: '❌', names: ['cross', 'no', 'wrong', 'バツ', 'だめ', '엑스'] },
  { emoji: '⭕', names: ['circle', 'correct', 'yes', 'まる', '丸', '동그라미'] },
  { emoji: '❓', names: ['question', 'what', 'はてな', '疑問', '질문'] },
  { emoji: '❗', names: ['exclamation', 'important', 'びっくり', '注意', '느낌표'] },
  { emoji: '⚠️', names: ['warning', 'caution', 'けいこく', '警告', '경고'] },
  { emoji: '💤', names: ['zzz', 'sleep', 'afk', 'ねる', '睡眠', '잠'] },
  { emoji: '💡', names: ['idea', 'light bulb', 'ひらめき', 'アイデア', '아이디어'] },
  { emoji: '🎲', names: ['dice', 'die', 'roll', 'さいころ', 'サイコロ', '주사위'] },
  { emoji: '⚔️', names: ['swords', 'battle', 'fight', 'けん', '剣', '戦闘', '전투'] },
  { emoji: '🛡️', names: ['shield', 'defend', 'たて', '盾', '방패'] },
  { emoji: '🏹', names: ['bow', 'arrow', 'ゆみ', '弓', '활'] },
  { emoji: '🪄', names: ['magic', 'wand', 'まほう', '魔法', '마법'] },
  { emoji: '🧙', names: ['wizard', 'mage', 'まほうつかい', '魔法使い', '마법사'] },
  { emoji: '🐉', names: ['dragon', 'ドラゴン', '竜', '용'] },
  { emoji: '👑', names: ['crown', 'king', 'おうかん', '王冠', '왕관'] },
  { emoji: '💰', names: ['money', 'gold', 'treasure', 'おかね', 'お金', '돈'] },
  { emoji: '🗝️', names: ['key', 'old key', 'かぎ', '鍵', '열쇠'] },
  { emoji: '📜', names: ['scroll', 'まきもの', '巻物', '두루마리'] },
  { emoji: '🍺', names: ['beer', 'tavern', 'ビール', '酒場', '맥주'] },
  { emoji: '🍵', names: ['tea', 'おちゃ', 'お茶', '차'] },
  { emoji: '🍰', names: ['cake', 'ケーキ', '케이크'] },
  { emoji: '🎯', names: ['target', 'bullseye', 'hit', 'めいちゅう', '命中', '명중'] },
  { emoji: '💥', names: ['boom', 'explosion', 'crit', 'ばくはつ', '爆発', '폭발'] },
  { emoji: '🩸', names: ['blood', 'damage', 'ち', '血', '피'] },
  { emoji: '💔', names: ['broken heart', 'heartbreak', 'しつれん', '失恋', '상심'] },
  { emoji: '🆗', names: ['ok', 'okay', 'オーケー', '오케이'] },
  { emoji: '🆖', names: ['ng', 'no good', 'だめ', '안돼'] },
];

/**
 * Every emoji the catalogue names, quick reactions first and each once, for a picker that shows
 * them all, as the chat input's does.
 */
export const CATALOG_EMOJIS: readonly string[] = [
  ...new Set([...DEFAULT_REACTION_EMOJIS, ...NAMED_EMOJIS.map(({ emoji }) => emoji)]),
];

/** How many emoji a search offers at most, to keep the picker small. */
export const MAX_REACTION_SEARCH_RESULTS = 24;

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * The query itself when it is one emoji a reader may leave, such as one pasted or typed from the
 * device's emoji keyboard; otherwise null. Only a single emoji counts, so a run of several, or any
 * text, is never offered as a reaction.
 */
export function typedReactionEmoji(query: string): string | null {
  const value = query.trim();
  if (!isReactionEmoji(value)) return null;
  if (segmenter && [...segmenter.segment(value)].length !== 1) return null;
  return value;
}

/**
 * The emoji to offer for what the reader typed into the picker's search: the typed emoji itself
 * when it is one, then those whose names hold the query. Empty for an empty query.
 */
export function searchReactionEmojis(query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return [];
  const found = new Set<string>();
  const typed = typedReactionEmoji(needle);
  if (typed) found.add(typed);
  for (const { emoji, names } of NAMED_EMOJIS) {
    if (found.size >= MAX_REACTION_SEARCH_RESULTS) break;
    if (emoji === needle || names.some((name) => name.toLocaleLowerCase().includes(needle))) found.add(emoji);
  }
  return [...found];
}
