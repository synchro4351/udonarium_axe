# 共有メモの部分Markdown（整形表示）

共有メモ（TextNote）に「通常／整形」の表示形式を追加した。整形では、限られたMarkdown記法だけを読む。

## 基点と範囲

- 基点：公式 Udonarium Axe v1.59.0 を取り込んだ custom mainline のコミット `f42e153bff5d70f8f99d70e6a41d7fa82097a234`
- 範囲：共有メモの表示だけ。通常チャット、シート項目の旧 `markdown` 型、チャットのコマンド処理には手を入れていない。

## 動き

| 項目           | 内容                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 既定           | `normal`。既存メモ、新規メモ、項目のない古いセーブは通常のまま                                                                                                       |
| 切り替え       | 右クリック「編集」のシートで「通常／整形」を選ぶ。メモごとの値で、同期と保存の対象                                                                                   |
| 整形で読む記法 | `# `〜`### `（空白必須）、`- `、`1. `、`> `、インラインコード、フェンスコード                                                                                        |
| 読まない記法   | `*`・`_` の強調、`* `・`+ ` の箇条書き、`1)`、`####` 以上、表、水平線、下線見出し、字下げコード、生HTML、リンク、画像、参照定義、自動リンク、GFMのタスク・取り消し線 |
| 改行           | 段落内の単一改行は `<br>`。空行は段落区切り（連続した空行は1つにまとまる）                                                                                           |
| ルビ           | 通常テキストのトークンだけに `applyRubyMarkup` を適用。コード内は文字のまま                                                                                          |
| `\s`           | 通常表示と同じく空白になる                                                                                                                                           |
| リンク化       | 整形表示には `linkify` を通さない。通常表示は従来どおり                                                                                                              |
| 公開範囲       | 閲覧できない参加者には、形式に関係なく従来のモザイク表示（卓上）とロック表示（ホバー概要）                                                                           |
| 編集           | テーブル上の直接編集もシートの本文欄も元の文を編集する。権限の判定は変更なし                                                                                         |
| 概要（ホバー） | 通常のメモは従来どおり本文の入力欄。整形のメモは整形表示になり、その場では編集できない。本文はシートかテーブル上で直す                                               |

CommonMarkと違い、引用や箇条書きの直後に `>`・行頭記号・字下げのない行が続くと、その行は引用・項目の外に出る（遅延継続をしない）。通常表示の引用と同じ区切り方にするためである。

## 記法をこの範囲に絞った理由

メモは卓の全員に同期され、書いた本人以外の画面にもそのまま描かれる。そのため、他人の画面で動いたり外へ通信したりする記法は入れていない。生HTML、リンク、画像、自動リンクがこれにあたる。画像は表示されるだけで外部へ読み込みが走る。

`*`・`_` の強調も読まない。`2*3` や `HP-1*2`、キャラクター名の `_` のように、TRPGのメモには記号がそのまま並ぶことが多く、強調として読むと意図しない箇所が斜体になる。残したのは行頭に置く記法だけで、見出し・箇条書き・引用・コードは、通常表示で書いても元の文として読める。

## パーサーに Marked を使った理由

自前の正規表現で HTML を組み立てるのはやめ、実績のあるパーサーに任せた。Marked にしたのは次の理由による。

- `marked@15.0.12` は semantic-release 系の推移的な devDependency として、もともと lockfile に固定されていた。実行時の依存に昇格させても、インストールされるパッケージや版は増えない。
- tokenizer を記法ごとに差し替えられる。使わない記法は `undefined` を返して止め、残す記法にも条件を付けられる。
- renderer を上書きでき、すべての文字列を既存の `escapeHtml` に通せる。ルビも同じ場所で掛けられる。
- 型定義を同梱しており、Marked 自身は他のパッケージに依存しない。

これにより、`marked@^15.0.12` が `dependencies`（実行時の依存）に加わる。`formatNoteText()` はこのパッケージを使うので、整形表示は Marked に依存する。

## 実装

- `src/app/domain/tabletop/text-note.ts`：`@SyncVar() textFormat`（既定 `'normal'`）と、正規化する `format` アクセサ、`toTextNoteFormat()`。TextNoteはObjectNodeなので、値はノード属性としてXMLに保存され、P2Pでも同期する。未知の値・文字列以外・欠落（古いピアのコンテキストで空文字になる場合を含む）は `normal` として読む。
- `src/app/ui/text-decoration/format-note-text.ts`：`formatNoteText()`。専用の `Marked` インスタンスで、`gfm: false`。使わない tokenizer は `undefined` を返して止め、見出し・リスト・引用は条件を確かめてから元の tokenizer を呼ぶ。引用とリストは、該当行だけを切り出して渡す。text レンダラーは `escapeHtml` → ルビ → 改行の順で処理する。fence の言語名は出力しない。`html`・`link`・`image` レンダラーは、万一トークンが来ても元の文字列をエスケープして出す。パーサーが例外を出したら通常表示の装飾に戻す。生成済みHTMLを正規表現で書き換える処理はない。
- `src/styles.css`：`.note-formatted`。Preflightで消える見出し・リスト・引用・コードの見た目を最小限戻す。既存の `.chat-quote`・`.chat-ruby` と同じく、innerHTML用のグローバル定義。
- `src/app/features/tabletop/text-note/`：卓上表示の切り替え（`isFormatted`・`formattedHtml`）と、記号挿入の純関数 `text-note-format-marks.ts`。
- `src/app/features/character/game-character-sheet/`：メモのシートに形式スイッチ、整形時の挿入ボタン（見出し `## `、箇条書き、番号、引用、コード）、短い説明、プレビュー。
- `src/app/features/inventory/overview-panel/`：ホバー概要。`noteFormattedHtml` は、整形のメモに限って `formatNoteText()` の結果を返す。それ以外は `null` を返して、従来の入力欄を出す。`objectVersion()` を読むので、形式や本文が変わると表示も追従する。閲覧の判定（`canViewObject()`）は従来のまま外側で行う。
- i18n：`feature.textNote.format.*` を ja/en/ko に追加。
- マニュアル：`website/manual/notes.md` に「本文の表示形式（通常／整形）」を追加。

## 変更したファイル

| 区分     | ファイル                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------- |
| 依存     | `package.json`、`package-lock.json`                                                                |
| ドメイン | `src/app/domain/tabletop/text-note.ts`、同 `.spec.ts`                                              |
| UI部品   | `src/app/ui/text-decoration/format-note-text.ts`、同 `.spec.ts`（新規）                            |
| 卓上メモ | `src/app/features/tabletop/text-note/text-note.component.{ts,html,spec.ts}`                        |
|          | `src/app/features/tabletop/text-note/text-note-format-marks.ts`、同 `.spec.ts`（新規）             |
| シート   | `src/app/features/character/game-character-sheet/game-character-sheet.component.{ts,html,spec.ts}` |
| 概要     | `src/app/features/inventory/overview-panel/overview-panel.component.{ts,html,spec.ts}`             |
| 見た目   | `src/styles.css`                                                                                   |
| 文言     | `src/assets/i18n/{ja,en,ko}.json`                                                                  |
| 文書     | `website/manual/notes.md`、`docs/TYOITASHI_SHARED_NOTE_FORMATTING.md`（新規）                      |

`package-lock.json` の差分は、ルートの依存への `marked` の追加と、`node_modules/marked` から `"dev": true` を外したことだけ。`npm ci` が通ることを確認している。

## 確認したこと

- `npx vitest run`：formatter、記号挿入、TextNote、卓上メモ、シート、チャットメッセージ、i18nキーの各spec。ホバー概要の spec は 44 件成功（追加した通常・整形・追従・非公開の4件を含む）。追従のテストは、`noteFormattedHtml` から `objectVersion()` の読み取りを外すと落ちることも確かめた。
- `ng test --include`（Angular builder 経路）：本機能の spec で 129 件成功。ホバー概要の spec は 44 件成功。
- 変更ファイルへの `eslint`、`prettier --check`、`tsc -p tsconfig.spec.json --noEmit`。
- `npm run build`：成功。initial total 2.99 MB で、予算（警告 3.1 MB）内。
- `npm ci`：成功。本番依存の `npm audit`：marked に該当なし。本変更と関係のない推移的依存 `axios` に high が1件ある。
- Chromium実画面：通常／整形の切り替え、見出し・リスト、数式のアスタリスク、HTMLとコードの文字表示、通常への復帰を確認。スクリーンショットを撮影。別端末での同期と実卓の読みやすさは利用者の確認対象。

## 制限

- 整形表示の対象は、卓上メモ、シートのプレビュー、ホバー概要。チャットログ、読み上げ、コピー、頭上吹き出しには関係しない。
- 文の次の行から空行なしで番号付きの箇条書きを始められるのは `1. ` だけ（CommonMarkの規則）。`2. ` から始めるなら前に空行を入れる。
- テーブル上の直接編集には形式スイッチを置いていない。小さいメモでは入らず、3D変形の中にあるため。
- `《名前》` のエフェクト命令とルビの重なり、チャットの命令抑止は扱っていない。

## 公式版へ持っていく場合

この変更は、公式 v1.59.0 を取り込んだ custom mainline の上で書いた。基点の時点で、TextNote、卓上メモと概要パネルのコンポーネント、`package.json`・`package-lock.json`、マニュアルは公式 v1.59.0 と同じ内容である。一方、シートのコンポーネントとその spec、i18n の JSON、`styles.css`、概要パネルの spec には custom mainline 側の変更が入っている。シートのメモ編集欄そのものは公式にもある。公式 Axe へ出すなら、上の表のファイルを公式の同じファイルと突き合わせて移植する。コミットをそのまま cherry-pick しても、きれいに当たるとは限らない。

移植しやすい順に並べると次のとおり。

1. ドメインの `textFormat` と `format` アクセサ（他に依存しない）。
2. `formatNoteText()` とその spec、`.note-formatted` のCSS。`marked@^15.0.12` を実行時の依存に加える必要がある。公式の lockfile に同じ版がなければ、新しいパッケージの追加になる。
3. 卓上メモ、シート、ホバー概要の表示切り替え。公式側のテンプレートに合わせて当て直す。

属性名 `textFormat` と値 `normal`・`formatted` はセーブデータに残る。名前を変えるなら、公式に出す前に決めておく。
