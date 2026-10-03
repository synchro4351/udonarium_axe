# カットインエディタ レイヤー設定のグループ化

## 基準

- ベース: `70fbd8b1028be73806b83a367d0f7a7caf259176`
- ブランチ: `codex/cutin-controls-layout`
- 対象: `src/app/features/media/cut-in-editor/cut-in-layer-properties.component.*`、`src/assets/i18n/{ja,en,ko}.json`、`e2e/cut-in-letter-controls.spec.ts`

## 変更点

従来の「位置・動き・効果」1 つの折りたたみを、種別ごとの意味のあるセクションに分けた。項目・有効/無効の条件・書き込み処理はそのままで、並びとグループだけを変えている。

| セクション            | 対象         | 初期状態 | 中身                                                                                    |
| --------------------- | ------------ | -------- | --------------------------------------------------------------------------------------- |
| 文字の書式            | 文字         | 開       | 大きさ、太さ、色、揃え、縁、字間、行間、縦書き、フォント                                |
| 文字ごと              | 文字         | 閉       | 「ふわっと/弾む/波打つ」→ 動き → 出現順・傾け方・退場・入ってくる向き・各時間・字の傾き |
| 帯の色と形            | 帯           | 開       | 色、グラデーション、形、サイズ、終わりの色、中間色、角度                                |
| 位置とサイズ          | 全種別       | 閉       | X、Y、幅、高さ、拡大率、回転                                                            |
| 全体の動き            | 全種別       | 閉       | 表示開始/終了、登場、退場、長さ、めくり、崩し、補間（キーがあるときだけ）               |
| 見た目と効果          | 全種別       | 閉       | 不透明度、ぼかし、傾き X/Y、切り抜き、エフェクト（強さ・色）、全体の見た目              |

- 文字レイヤーは全体の書式 → 共通 3 セクション → 文字ごとの順。
- 「キャラ名を入れる」ボタンを削除。テキスト欄のプレースホルダー `{character}でキャラ名を挿入` に置き換えた（トークン `{character}` と再生時の置換は変更なし）。
- 長い説明文は表示せず、ツールチップ（`title`）に移した（立ち絵、終了 0、登場・退場、文字ごとの時間）。
- 文字の「動き」セレクタは `文字ごと` の中に移し、プリセットボタンを先に置いた。
- 開閉は素の `<details>` で、状態は DOM のみ。レイヤーにもアンドゥにも書かない。

## スキーマ・データ

変更なし。`CutInLayer` の `SyncVar`、保存 XML、キー・トラックの扱い、`commit` の出方（1 操作 1 アンドゥ）は従来どおり。閲覧専用時は全コントロールが無効のまま。

i18n: `sectionPosition` / `sectionMotion` / `sectionStyle` / `sectionText` / `sectionBand` を追加。`letterDetails` は「文字ごと」へ、`letterMotion` は「動き」へ、`textPlaceholder` は上記に変更。使われなくなった `layerDetails` / `insertCharacter` / `insertCharacterHint` / `effects` / `presets` を削除した。`effect` のラベルは「エフェクト」。

テストの testid: `cut-in-layer-details`（位置とサイズ）、`cut-in-section-motion`、`cut-in-section-style`、`cut-in-section-text`、`cut-in-section-band`、`cut-in-letter-details`（文字ごと）。

## テスト

- `cut-in-layer-properties.component.spec.ts`: 文字ごとの内容と順序、文字の書式 → 共通 → 文字ごとの並び、プレースホルダーとボタン削除、開閉がレイヤーとアンドゥに触れないこと、3 種別でのセクション内容と初期状態、帯・画像の構成、めくり/崩し/補間/エフェクトの出し分け、閲覧専用で全コントロールが無効なこと。
- 実行: `npx vitest run cut-in-editor i18n-keys i18n-choices`、`npm run build`、`eslint`。
- Claude側で実行できなかったAngular builder・整形・ブラウザ確認をCodexで補完。対象Angularテスト77件成功、Prettier実行、production build成功、Chromiumの文字ごと・取り消しのテスト1件成功。プリセットは閉じた「文字ごと」を開いて操作する。
- Chromiumのテキスト設定と文字ごとの画面を撮影し、表示を確認する。利用者の目視確認は次のチェックリストに分離する。

## README 案

> カットインのレイヤー設定を「位置とサイズ」「全体の動き」「見た目と効果」に分け、文字レイヤーは「文字の書式」と「文字ごと」を別に開けるようにしました。キャラ名の挿入はテキスト欄に `{character}` と書きます。
