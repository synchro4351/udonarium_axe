/**
 * The words each stamp that comes with the app may be found by, besides its name: other ways of
 * saying the same thing, readings and close feelings, so that searching for 閃き or アイデア finds
 * ひらめいた!. Katakana and hiragana, and full and half width, are read alike when searching (see
 * `normalizeStampWord`), so a word need be written in only one of them.
 *
 * A stamp is named by its identifier, `family:key`, as in `BUILTIN_STAMPS`. Add words freely; a
 * stamp left out is found by its name alone.
 */
export const STAMP_WORDS: Readonly<Record<string, readonly string[]>> = {
  // The sound effects of a comic.
  'sfx:laugh': ['わらい', '笑う', 'ウケる', 'www', '草', 'おもしろい'],
  'sfx:shock': ['驚く', 'がーん', 'びっくり', '衝撃'],
  'sfx:creepy': ['怖い', 'ぞくぞく', 'ホラー', '不気味'],
  'sfx:heart': ['好き', 'ハート', '愛', 'らぶ'],
  'sfx:clap': ['ぱちぱち', 'すごい', '称賛', 'ナイス'],
  'sfx:notice': ['はっ', '気付く', '発見'],
  'sfx:gulp': ['ごくり', 'どきどき', '固唾'],
  'sfx:smirk': ['にやり', 'ニヤ', '悪だくみ', '策略'],
  'sfx:boom': ['どーん', '展開', '急展開', 'ドカーン'],
  'sfx:menace': ['ゴゴゴ', '不穏', '殺気', '威圧'],
  'sfx:silence': ['しーん', '沈黙', '無言'],
  'sfx:stare': ['じーっ', '凝視', '見つめる', 'ジト目'],
  'sfx:thump': ['どきっ', 'ときめき', 'ドキドキ'],
  'sfx:excited': ['わくわく', 'たのしみ', '期待'],
  'sfx:flop': ['ズコー', 'ずっこける', 'コケる'],
  'sfx:shine': ['きらーん', '輝く', 'キラキラ'],
  'sfx:startle': ['ぎくっ', 'ドキッ', '図星'],
  'sfx:murmur': ['ざわざわ', 'どよめき', '騒然'],
  'sfx:entrance': ['ばーん', '参上', '見参', '颯爽'],
  'sfx:glance': ['ちら', 'ちらっ', '横目'],
  'sfx:huff': ['怒る', 'むかっ', 'プンスカ', '怒り'],
  'sfx:gloom': ['ずーん', 'しょんぼり', '凹む', 'へこむ'],
  'sfx:idea': ['閃き', 'ひらめいた', 'アイデア', 'アイディア', '思いつき', 'ピコーン'],
  'sfx:leanin': ['乗り出す', '食いつく', '興味津々'],
  'sfx:roll': ['ころころ', 'サイコロ', 'ダイス', '振る'],
  'sfx:dumbfounded': ['唖然', '呆然', '口あんぐり'],

  // The round seals of a name stamp.
  'seal:ok': ['了承', 'りょ', 'おけ', 'OK', 'わかった', '承知'],
  'seal:seen': ['既読', '確認', 'みた', 'チェック'],
  'seal:lol': ['わら', 'w', '笑う'],
  'seal:wow': ['驚く', 'びっくり', 'まじか'],
  'seal:fear': ['怖い', 'ひえっ', '恐怖'],
  'seal:sob': ['泣く', '涙', 'うるっ', 'エモい'],
  'seal:god': ['かみ', '神回', '最高', 'ありがたい'],
  'seal:precious': ['とうとい', 'てぇてぇ', '尊み'],
  'seal:agree': ['同意', 'うん', 'たしかに'],
  'seal:really': ['ほんまか', '本当に', '疑問', 'そうかな'],
  'seal:fair': ['なるほど', '納得', 'たしかに'],
  'seal:unfair': ['納得できない', 'ないない'],
  'seal:noobjection': ['賛成', '同意', 'いいよ'],
  'seal:objection': ['反対', '待った', 'ちょっと待った'],
  'seal:gotit': ['理解', 'わかった', '把握'],
  'seal:thatsit': ['それ', 'まさに', '同意'],
  'seal:relate': ['わかる', 'あるある', '共感'],
  'seal:lmao': ['爆笑', '腹筋', 'www', '大草原'],
  'seal:genius': ['てんさい', 'すごい', '天才的'],
  'seal:win': ['ゆうしょう', '勝ち', '勝利', '一位'],
  'seal:best': ['さいこう', '最高だ', 'ベスト'],
  'seal:capable': ['ゆうのう', 'できる', '有能すぎる'],
  'seal:noway': ['むり', 'できない', 'ムリ'],
  'seal:approved': ['しょうにん', 'OK', '許可', '合格'],
  'seal:rejected': ['きゃっか', 'NG', 'ダメ', '不許可'],
  'seal:foreshadow': ['ふくせん', '伏線回収', 'フラグ'],
  'seal:ominous': ['ふおん', '嫌な予感', 'フラグ'],
  'seal:rip': ['がっしょう', 'ご冥福', 'ナムアミダブツ', '南無'],
  'seal:done': ['すみ', '完了', 'おわり', '済'],
  'seal:congrats': ['お祝い', '祝', 'めでたい', 'おめ'],
  'seal:thanks': ['ありがとう', 'かんしゃ', 'サンクス', '感謝感激'],
  'seal:secret': ['内緒', '秘密', 'シークレット'],
  'seal:lucky': ['きち', '大吉', 'ラッキー', '運がいい'],
  'seal:unlucky': ['きょう', '大凶', 'アンラッキー', '運が悪い'],

  // Rolling dice.
  'roll:critical': ['クリティカル', '大成功', 'クリ', '6ゾロ'],
  'roll:fumble': ['ファンブル', '大失敗', '1ゾロ', 'ピンゾロ'],
  'roll:success': ['せいこう', '成功した', 'やった'],
  'roll:failure': ['しっぱい', '失敗した', 'ダメだった'],
  'roll:pray': ['いのる', 'お祈り', '頼む', 'お願い'],
  'roll:throw': ['えい', '振る', 'それっ'],
  'roll:reroll': ['振り直し', 'リロール', 'もう一回'],
  'roll:shake': ['しゃかしゃか', '振る', 'ダイスを振る'],
  'roll:blow': ['息', 'ふーっ', 'おまじない'],
  'roll:stare': ['にらむ', '出目', '睨む'],
  'roll:sanity': ['SAN', 'サンチェック', '正気度', '発狂'],
  'roll:secret': ['シークレット', 'ひみつ', '秘匿'],
  'roll:count': ['計算', '修正値', '補正'],
  'roll:clover': ['幸運', 'お守り', 'クローバー', 'ラッキー'],
  'roll:cursed': ['呪い', 'のろい', '腐ってる'],
  'roll:nervous': ['どきどき', '緊張', 'ハラハラ'],
  'roll:aghast': ['えっ', 'うそ', 'まさか'],
  'roll:bonus': ['ボーナス', '加算', 'プラス'],
  'roll:hoard': ['ダイス好き', 'コレクション', 'サイコロ'],
  'roll:doubt': ['怪しい', 'いかさま', '疑う'],

  // Battle.
  'battle:sword': ['きる', '斬撃', '攻撃', '剣', 'アタック'],
  'battle:shield': ['まもる', '防御', '盾', 'ガード'],
  'battle:magic': ['まほう', '呪文', '詠唱', 'スペル', '魔術'],
  'battle:bow': ['弓', '射撃', 'ねらう', 'スナイプ'],
  'battle:charge': ['とつげき', '突っ込む', 'いくぞ'],
  'battle:hurt': ['いたい', 'ダメージ', '被弾'],
  'battle:heal': ['かいふく', 'ヒール', '治療', '回復魔法'],
  'battle:fainted': ['戦闘不能', '気絶', 'ダウン', '倒れる'],
  'battle:dodge': ['かいひ', 'よける', '回避成功'],
  'battle:victory': ['しょうり', '勝った', '勝ち'],
  'battle:flee': ['にげる', '撤退', '退却'],
  'battle:berserk': ['本気', 'ほんき', '覚醒', 'バーサク'],
  'battle:stunned': ['ぴよぴよ', 'スタン', '気絶'],
  'battle:poison': ['どく', '毒状態'],
  'battle:asleep': ['ねむり', '睡眠', 'すやすや'],
  'battle:buff': ['パワーアップ', 'バフ', '強化'],
  'battle:taunt': ['挑発', 'あっかんべ', 'べー'],
  'battle:protect': ['かばう', 'カバー', '庇う'],
  'battle:smash': ['こんしん', '必殺', '一撃', 'クリティカルヒット'],
  'battle:ready': ['かかってこい', '構える', '準備万端'],
  'battle:lowhp': ['瀕死', 'ひんし', 'HP1', 'ピンチ'],

  // Exploring.
  'explore:magnifier': ['しらべる', '調査', '探索', '虫眼鏡'],
  'explore:listen': ['ききみみ', '聞く', '耳をすます'],
  'explore:sneak': ['しのびあし', '隠密', 'こっそり', 'スニーク'],
  'explore:found': ['みつけた', '発見', 'あった'],
  'explore:map': ['ちず', 'マップ', '道'],
  'explore:treasure': ['おたから', '宝', '財宝', 'トレジャー'],
  'explore:trapped': ['わな', 'トラップ', '罠だ'],
  'explore:lockpick': ['かぎあけ', '解錠', 'ピッキング'],
  'explore:torch': ['くらい', '暗闇', '松明', '明かり'],
  'explore:think': ['かんがえる', '思案', 'うーん'],
  'explore:idea': ['ひらめき', '閃き', 'アイデア', 'アイディア', '思いつき', 'わかった'],
  'explore:puzzled': ['わからない', 'なぞ', '謎', '困った'],
  'explore:shop': ['かいもの', 'ショップ', '買い物'],
  'explore:eat': ['ごはん', '食事', 'めし', 'たべる'],
  'explore:camp': ['やえい', 'キャンプ', '休む', '野宿'],
  'explore:toast': ['かんぱい', '乾杯!', 'お酒', '打ち上げ'],
  'explore:tome': ['ぶんけん', '本', '図書館', '調べもの'],
  'explore:peek': ['のぞく', 'こっそり', 'そっと'],
  'explore:lost': ['まいご', '迷う', '道に迷う'],
  'explore:knock': ['のっく', 'こんこん', 'ノックする'],

  // Feelings.
  'feel:smile': ['えがお', '笑顔', 'にっこり', 'うれしい'],
  'feel:laugh': ['爆笑', 'わらう', 'www'],
  'feel:cry': ['なく', '泣く', '涙', 'ぴえん'],
  'feel:angry': ['おこ', '怒る', '激おこ', 'ぷんぷん'],
  'feel:shock': ['がーん', 'ショック', '落ち込む'],
  'feel:blush': ['てれる', '照れ', '赤面', 'はずかしい'],
  'feel:smug': ['どや', 'ドヤ顔', '得意'],
  'feel:love': ['すき', '大好き', 'ラブ', 'ハート'],
  'feel:scared': ['こわい', '怖い', 'ひえっ'],
  'feel:awkward': ['きまずい', '気まずい', '微妙'],
  'feel:confused': ['はて', 'え?', '首をかしげる', '疑問'],
  'feel:excited': ['わくわく', 'たのしみ', '楽しい'],
  'feel:pout': ['むすっ', '不機嫌', 'すねる'],
  'feel:sigh': ['ためいき', 'はぁ', 'やれやれ'],
  'feel:sleepy': ['ねむい', '眠い', 'うとうと'],
  'feel:evil': ['けいかくどおり', '黒幕', 'ニヤリ', '悪役'],
  'feel:moved': ['かんどう', '感激', 'エモい', 'じーん'],
  'feel:blank': ['きょむ', '無', '真顔', '無表情'],
  'feel:proud': ['えっへん', '自慢', 'ふふん'],
  'feel:panic': ['あわわ', 'パニック', '焦る', 'あたふた'],

  // Talking at the table.
  'talk:ok': ['おっけー', 'OK', 'いいよ', '了解'],
  'talk:no': ['だめ', 'NG', 'いや'],
  'talk:wait': ['まって', '待った', 'ちょっと待って', 'タンマ'],
  'talk:hello': ['こんにちは', 'やあ', 'あいさつ', 'よろしく'],
  'talk:goodgame': ['おつかれ', 'お疲れ様', 'GG', '乙'],
  'talk:thanks': ['ありがとう', '感謝', 'サンキュー', 'あざす'],
  'talk:sorry': ['ごめん', 'すみません', '申し訳ない'],
  'talk:question': ['しつもん', '質問です', 'はい'],
  'talk:agree': ['うんうん', '同意', 'そうそう'],
  'talk:beg': ['おねがい', 'お願い', '頼む'],
  'talk:brb': ['離席', 'りせき', 'ちょっと抜ける', '席を外す'],
  'talk:goodnight': ['おやすみ', 'おやすみなさい', '寝る'],
  'talk:tea': ['きゅうけい', '休憩', 'ひと休み', 'お茶'],
  'talk:clap': ['ぱちぱち', '拍手', 'すごい'],
  'talk:cheer': ['がんばれ', '応援', 'ファイト'],
  'talk:popcorn': ['見守る', 'みまもり', '観戦', 'ポップコーン'],
  'talk:memo': ['めも', 'メモ', '記録', 'ノート'],
  'talk:rules': ['ルール', 'ルールブック', '確認'],
  'talk:hurry': ['じかん', '時間', 'いそいで', '巻きで'],
  'talk:letsplay': ['あそぼう', '遊ぶ', 'セッション'],
  'talk:ruling': ['GM判断', '裁定', 'じーえむ'],
  'talk:oshi': ['おし', '推し', '推せる'],
  'talk:foreshadow': ['伏線', 'ふくせん', 'フラグ'],
};

/**
 * A word as searching reads it: full and half width alike, upper and lower case alike, and
 * katakana read as hiragana, so that ヒラメキ, ひらめき and ﾋﾗﾒｷ find the same stamps.
 */
export function normalizeStampWord(word: string): string {
  return word
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[ァ-ヶ]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) - 0x60));
}

/** Whether any of a stamp's names and words holds what is searched for. */
export function stampMatchesQuery(texts: readonly string[], query: string): boolean {
  const needle = normalizeStampWord(query.trim());
  if (!needle) return true;
  return texts.some((text) => normalizeStampWord(text).includes(needle));
}
