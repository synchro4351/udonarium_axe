# 公式との差分・再利用のための変更一覧

[紹介ページ](README.md) · [版ごとの履歴](TYOITASHI_VERSIONS.md)

r5までの比較対象は公式Axe v1.57.1（85c89f98）です。開発版は公式v1.58.0（46707582）とv1.59.0（19e9d1c7）を取り込んでいます。ここでは元の機能コミットを示します。後から公式の構造変更に合わせた調整もあるため、現在の実装はr1〜r4の固定ソースと併せて確認してください。

## カットイン詳細の折り畳み（開発版）

- [a06b80e8](https://github.com/synchro4351/udonarium_axe/commit/a06b80e8)：シーンの基本操作とレイヤー一覧を残し、タイムライン・レイヤーの詳細・多方向表示を折り畳むUI変更。基点は17ba32be。開閉はUI内だけの状態で、保存・同期形式は増やしません。閲覧専用入力のdisabled状態もフォームへ揃えました。
- [34140927](https://github.com/synchro4351/udonarium_axe/commit/3414092749630e99a008273ab50a0b9f4ef0da14)：[利用方法と再利用時の注意](https://github.com/synchro4351/udonarium_axe/blob/codex/cutin-ui-disclosure/docs/TYOITASHI_CUTIN_DISCLOSURE.md)。共有メモ機能を含む基点ですが、折り畳みの処理は共有メモに依存しません。既存の私家版シーン編集へ加えたため、公式の項目に合わせた適用が必要です。

## 共有メモの部分Markdown（開発版）

- [441f4a13](https://github.com/synchro4351/udonarium_axe/commit/441f4a13)：通常／整形の選択、制限したMarkdown、編集プレビューと記号挿入、卓上・ホバー表示。基点は公式v1.59.0統合済みのf42e153b。属性`textFormat`を既存の保存・同期へ追加し、欠落・未知の値は通常表示にします。Marked 15.0.12を実行時依存に追加します。
- [17ba32be](https://github.com/synchro4351/udonarium_axe/commit/17ba32be9c22fad3ccc313553f74aa203ae91355)：[仕様・変更範囲・公式へ移す時の注意](https://github.com/synchro4351/udonarium_axe/blob/codex/shared-note-formatting/docs/TYOITASHI_SHARED_NOTE_FORMATTING.md)。シート・翻訳・スタイルなどには既存の私家変更があり、そのまま公式へcherry-pickできるとは限りません。チャットのMarkdown化は含みません。

## v1.59.0追従

- [fb24e752](https://github.com/synchro4351/udonarium_axe/commit/fb24e752f58b78ce7c74e2026eb653a7f54ddc47)：私家版9ca3489aを基点に、公式固定タグv1.59.0（19e9d1c7）を一度merge。公式のスイッチ・コンパス・ボタン名ガイドなどを取り込み、アプリ初期化とチャット送信の競合で既存の私家機能を保持しました。独立した機能パッチではありません。
- [686765fe](https://github.com/synchro4351/udonarium_axe/commit/686765fee5c7c157926811c0d42c67b053f0ce90)：上記の後続。公式のボタン名ガイドに私家版の手札アイコンを描画する小修正です。公式v1.59.0のガイドと既存の手札アイコンに依存します。保存・同期形式の変更はありません。
- [f42e153b](https://github.com/synchro4351/udonarium_axe/commit/f42e153bff5d70f8f99d70e6a41d7fa82097a234)：見学者に読込・キャラ取り込み操作を表示しない現行メニュー仕様へ、ブラウザテストの期待値を修正しました。アプリの動作変更はありません。
- [追従ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/upstream-v1-59-0)。スイッチの定義・権限・実行制限は公式と同じです。旧版でスイッチを含む部屋を再保存する互換性は保証しません。

## v1.58.0追従と初期ホットバー見本

- [d8b27baa](https://github.com/synchro4351/udonarium_axe/commit/d8b27baa1b80b1fccc0703f2bf903a9d12caedd1)：r5を基点に公式v1.58.0を一度merge。私家版スタンプと手札メニュー入口・更新印を新メニュー構造へ接続。公式のメニュー配置は端末ローカル保存です。
- [18043e6d](https://github.com/synchro4351/udonarium_axe/commit/18043e6d3f4050dc7b3fdfa1f9730b94bf0b5f58)：新規利用者のホットバー初回表示に、送信しない入力見本を3つ配置。既存・読み込み済みのバーは変更しません。
- [b12d2400](https://github.com/synchro4351/udonarium_axe/commit/b12d240072044f952ee27b815734fb80b622de43)：上記を基点に、見本をダイス入力・キャラクターシート・視点移動の3種類へ変更。初回配置の条件は維持し、動かすキャラクターの指定がない場合の案内を修正しました。[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/hotbar-discovery-samples)。

## 入口UIと新規カットインのプレビュー

- 基点：[b12d2400](https://github.com/synchro4351/udonarium_axe/commit/b12d240072044f952ee27b815734fb80b622de43)。公式v1.58.0を取り込んだ私家版本流が前提です。
- [e56b7688](https://github.com/synchro4351/udonarium_axe/commit/e56b768820ae83b73a4dc89145c0afb9fdb5d5de)：未配置時のホットバー・手札をチャットの横または上へ配置し、手札一覧をバーの近くへ開きます。手札ヘッダー、画像の追加領域、スタンプ管理とキャラクター画像関連の操作名を整理。操作権限・画像取り込み処理・保存形式は維持します。
- [9ca3489a](https://github.com/synchro4351/udonarium_axe/commit/9ca3489a9cee64bcc4ff08aaea2f87a903afc270)：上記を基点に、新規見本カットインの初期プレビューを素材と文字が出揃う時刻へ変更。本人画面の作成直後のみで、シーンの保存データや再生開始時刻は変更しません。[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/ui-entry-cleanup)。
- 関連の直接VitestとAngular経由テスト、通常コミットフック、画像パネルのChromium E2E、1440px・1024pxの初期配置と保存済みホットバー位置を確認。幅390pxは既存モバイル配置を維持。手札とホットバー同士の自動整列や、移動済みチャットへの追従は含めません。

## 機能別の入口

以下のコミットは、特記のない限りこのフォークの履歴です。古い機能ブランチを丸ごと最新公式へmergeすることを推奨する表ではありません。

| 変更 | 元コミット・範囲 | 基点と取り込み時の注意 |
| --- | --- | --- |
| チャット読み上げ | [cde159ae](https://github.com/synchro4351/udonarium_axe/commit/cde159ae)、[時計差対応 1d52f8ba](https://github.com/synchro4351/udonarium_axe/commit/1d52f8ba)、[自己発言 4d0c50ab](https://github.com/synchro4351/udonarium_axe/commit/4d0c50ab) | 本体はv1.48.0、後続2修正はv1.49.0時点。本体と新着判定・自己発言の修正を一緒に確認。設定は端末ローカル。現在の層構成への調整はv1.57.1統合時にも含まれる |
| カード文章の縁取り | [dd70db67](https://github.com/synchro4351/udonarium_axe/commit/dd70db67)、[太字・光彩 ba818f32](https://github.com/synchro4351/udonarium_axe/commit/ba818f32) | 旧v1.50系。公式採用済みのカード文章実装を前提にする。縁取り切替による改行位置の変化を抑える |
| マップマスク文章・縁取り | [ae429977](https://github.com/synchro4351/udonarium_axe/commit/ae429977)、[描画調整 d1805678](https://github.com/synchro4351/udonarium_axe/commit/d1805678) | 旧v1.50系。カード文章との共通処理や後の公式マスク設定UIとの調整を確認。Flyのデータ構造を意識した実装 |
| 再参加待機・v1.57.1への適応 | [889c0dfd](https://github.com/synchro4351/udonarium_axe/commit/889c0dfd) | 公式85c89f98と旧私家版のmerge。再参加だけの独立コミットではない。SkyWayFacade・RoomJoinService・参加画面の変更を抽出して確認する必要あり。Windows向け検証処理の調整も含む |
| 未指定マスク文字色を白に | [6ba6751a](https://github.com/synchro4351/udonarium_axe/commit/6ba6751a) | 上記v1.57.1統合版起点。保存済み・明示指定した色は変更しない |
| カットインのフォント選択 | [14101a33](https://github.com/synchro4351/udonarium_axe/commit/14101a33) | 6ba6751a起点。編集UI・翻訳・テスト。既存のfontFamily文字列を使用し、端末フォントへフォールバックする |
| YouTube再生操作 | [f45a18c5](https://github.com/synchro4351/udonarium_axe/commit/f45a18c5) | 6ba6751a起点。プレイヤーのサムネイル待機を無効化、クリック遮断を除去、操作欄を表示 |
| チャット入力後の初回ドラッグ | [0605e7ba](https://github.com/synchro4351/udonarium_axe/commit/0605e7ba) | 14101a33起点。入力要素のblurとwindowのblurを区別。保存・同期の変更なし |
| YouTube自動再生（r2） | [42bdbd97](https://github.com/synchro4351/udonarium_axe/commit/42bdbd97) | be1fdb8a起点。f45a18c5の再生操作修正を前提とする。開始時にiframe生成・autoplay要求、既存の時刻合わせと操作欄を維持 |
| ホットバーのエフェクトアイコン（r2） | [2a75e5c2](https://github.com/synchro4351/udonarium_axe/commit/2a75e5c2) | 42bdbd97起点。既存のeffect-shapesのSVGとng-selectを使用。保存値は従来のエフェクト名のまま |
| 編集可能なカットイン見本3種（r2） | [13e18a3f](https://github.com/synchro4351/udonarium_axe/commit/13e18a3f) | 2a75e5c2の後続。既存のCutIn・シーン・レイヤー・アニメーションプリセットを使用。既存カットインに不干渉、保存・同期形式を追加しない |

[小改善2件の機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/hotbar-effect-icons-and-cutin-presets)は、公式v1.57.1に私家機能を加えた42bdbd97を基点としています。

手札の受け渡し（r2）：[929eec63](https://github.com/synchro4351/udonarium_axe/commit/929eec63ca7c1f6424106b0c15a6256a12e95a99)、[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/card-player-transfer)。基点は上記2件を含む1c285e05。既存のCardGameServiceと手札UIへ追加し、既存のCard.toHandで移動するため保存・同期の新項目はありません。実行直前に手札の所在・操作側ロール・受取人を再確認します。公開手札・自動ソート・配布元表示は含みません。

手札の公開・秘匿（r2）：[5a0cc8e4](https://github.com/synchro4351/udonarium_axe/commit/5a0cc8e4)。929eec63起点。公開設定はPeerCursorの同期値で、既定秘匿・再接続時も秘匿。ルームセーブ対象外です。

自動ソート（r2）：[d9a3280a](https://github.com/synchro4351/udonarium_axe/commit/d9a3280a)。表示順だけを端末ごとに切り替え、共有のhandOrderは変更しません。設定はブラウザ内に保存します。

直前の渡し主（r2）：[da07bbd8](https://github.com/synchro4351/udonarium_axe/commit/da07bbd8)、[消去経路修正 15189c35](https://github.com/synchro4351/udonarium_axe/commit/15189c35)。Cardに渡し主ID・名前の保存・同期項目を追加。明示的な受け渡しで更新し、手札から出ると消します。旧セーブには項目がありません。これらは[同じ機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/card-hand-visibility-sort-provenance)の後続コミットで、929eec63以降の私家機能を含みます。

短いカットイン見本（r2）：[f137d9d1](https://github.com/synchro4351/udonarium_axe/commit/f137d9d1)。15189c35起点。既存の見本3種を短縮し、透明背景の見本12種を追加。既存のシーン・レイヤーとアニメーションプリセットを使い、保存・同期形式は変えません。

カットイン見本の図形差分（r2）：[元コミット f3f2b172](https://github.com/synchro4351/udonarium_axe/commit/f3f2b172)、[本流への取り込み f6e09ebb](https://github.com/synchro4351/udonarium_axe/commit/f6e09ebb)。既存のCutInClipとCutInFillShapeで、丸・星・裂けた帯・斜め帯などの形を見本ごとに変えます。録画テスト修正後の本流へcherry-pickしたためコミットIDは異なります。保存・同期形式や外部画像は増やしていません。

手札公開・場への配置の操作改善（r2）：[db74ee87](https://github.com/synchro4351/udonarium_axe/commit/db74ee87)。f137d9d1の後続。既存のPeerCursorの公開値とCard操作を使用。公開前の確認、閲覧専用画面、渡し主アイコンのカード外表示、ドロップ後の表裏選択を追加。新しい保存・同期項目はありません。

山札の表示更新（r2）：[5e9f3ee2](https://github.com/synchro4351/udonarium_axe/commit/5e9f3ee2)。db74ee87の後続。CardStackの変更通知を枚数・厚さ表示へ接続。通信自体の遅延原因は未特定です。[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/cutin-card-usability)には、この後にユーザー確認表の文書コミット6089e285も含みます。

録画テストの負荷耐性（r2）：[7b9c7da7](https://github.com/synchro4351/udonarium_axe/commit/7b9c7da7)。実装が許容するフレーム飛びをテストでも扱い、描かれたフレームの音声待機時間を確認します。製品の録画処理そのものは変更していません。

### 2026-09-26 の追加分（r2）

| 変更 | 本流コミット | 元の機能コミット・依存関係 |
| --- | --- | --- |
| カットイン見本の動き・文字表現 | [01bc84ea](https://github.com/synchro4351/udonarium_axe/commit/01bc84ea) | [32be84e0](https://github.com/synchro4351/udonarium_axe/commit/32be84e0)を1c228425起点へ取り込み。既存のシーン・レイヤー・アニメーション表現を使う |
| 新規カットインの枠なし既定値 | [619902cf](https://github.com/synchro4351/udonarium_axe/commit/619902cf) | [310fba81](https://github.com/synchro4351/udonarium_axe/commit/310fba81)を取り込み。新規作成時だけ変更し、保存済みカットインには影響しない |
| 手札の初回表示・更新通知・公開方式 | [6c465fbe](https://github.com/synchro4351/udonarium_axe/commit/6c465fbe) | [af1bcd8d](https://github.com/synchro4351/udonarium_axe/commit/af1bcd8d)。1c228425起点。新しい部屋設定は旧セーブでは「参加者が選択」 |
| カード編集権限・場と山札から渡す操作 | [bf14331d](https://github.com/synchro4351/udonarium_axe/commit/bf14331d)、[権限テスト 4e1e2715](https://github.com/synchro4351/udonarium_axe/commit/4e1e2715) | [8a3fcd1f](https://github.com/synchro4351/udonarium_axe/commit/8a3fcd1f)、[8b8e51f3](https://github.com/synchro4351/udonarium_axe/commit/8b8e51f3)。前行の手札変更が基点。部屋のカード編集許可は既定オフ、既存の受け渡し許可も適用 |

本流への取り込みでコミットIDが変わった行は、両方を記しました。これらは公式v1.57.1から直接cherry-pickできる独立パッチではなく、上記の私家版コミットを基点とします。公開手札の表示内容、山札内のカード一覧、権限の扱いを公式へ移す場合は、対象版で秘匿と同期を再検証してください。

| 2026-09-26の後続変更 | 本流コミット | 元コミット・取り込み時の注意 |
| --- | --- | --- |
| 手札一覧からドラッグで引く | [6d6d083c](https://github.com/synchro4351/udonarium_axe/commit/6d6d083c) | [783ba356](https://github.com/synchro4351/udonarium_axe/commit/783ba356)、基点4e1e2715。従来の専用画面を削除。既存の手札移動・部屋の引く許可を使う。キーボード／クリックで引く代替操作はない |
| カットイン文字の余分な空白 | [70fc8456](https://github.com/synchro4351/udonarium_axe/commit/70fc8456) | [44a0fdaf](https://github.com/synchro4351/udonarium_axe/commit/44a0fdaf)、基点4e1e2715。共通描画の空白をなくし、自作カットインの明示改行は保持 |
| 未知の切り抜き名を安全に表示 | [557525ba](https://github.com/synchro4351/udonarium_axe/commit/557525ba) | [908b6a1c](https://github.com/synchro4351/udonarium_axe/commit/908b6a1c)。この版が将来の未知の形状名を受け取っても、切り抜かずに表示する |
| カットイン見本の演出調整 | [fe0c0c7e](https://github.com/synchro4351/udonarium_axe/commit/fe0c0c7e) | [b2a32ec4](https://github.com/synchro4351/udonarium_axe/commit/b2a32ec4)。花束とハートを各1種に整理し、雨・星・上向き矢印・閃光・帯内の光を調整。矢印は既存形状だけで構成し、新しい保存値を増やさない |
| 「Level UP」の低い矢印 | [93ce5369](https://github.com/synchro4351/udonarium_axe/commit/93ce5369) | 19a98d7e起点。頭と軸の高さを約半分にし、文字を境目へ置く。既存の作例レイヤー形状を使い、保存済みカットインには影響しない |
| 手札メニューの独自アイコン | [c617725b](https://github.com/synchro4351/udonarium_axe/commit/c617725b) | 93ce5369起点。添付画像を参考に独自SVGを作成し、PC・モバイルのメニューで使用。保存・同期の変更なし |

## r3の追加変更

| 変更 | 本流コミット | 基点と取り込み時の注意 |
| --- | --- | --- |
| 不在参加者の手札をGMが引き継がせる | [bf66c752](https://github.com/synchro4351/udonarium_axe/commit/bf66c752) | r2固定ソース`6e5668dd`起点。[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/orphan-hand-recovery)。既存の手札位置とCard.toHandを使用。カードは伏せて移り、保存・同期形式を追加しない。最新の保存・再読込では複製なし。既存卓へのZIP重ね読み込みは再確認待ち |
| 自分の手札カードのホバー詳細 | [be02ffce](https://github.com/synchro4351/udonarium_axe/commit/be02ffce) | bf66c752起点。[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/hand-hover-preview)。場のカードと共通のツールチップを自分の手札へ適用。タッチ・ドラッグ中は抑止。他人の秘匿手札には適用しない。保存・同期形式の変更なし |
## r4の追加変更

発言別リアクション：[8cee77d4](https://github.com/synchro4351/udonarium_axe/commit/8cee77d4)（参加者別の保存・同期）、[45d1561b](https://github.com/synchro4351/udonarium_axe/commit/45d1561b)（HTMLログ）、[c5d53252](https://github.com/synchro4351/udonarium_axe/commit/c5d53252)（選択画面）。r3固定ソース`cf5edecf`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-reactions)。発言ごと・参加者ごとに別の同期オブジェクトを使い、複数人の同時操作で票を上書きしない。従来の保存ZIPは反応なしとして読込。利用者がローカルで基本動作を確認済み。実2端末と弱回線での確認は未実施です。

プレーンテキストのログ：[66490d3d](https://github.com/synchro4351/udonarium_axe/commit/66490d3d)（文字列生成）、[d1d26ea5](https://github.com/synchro4351/udonarium_axe/commit/d1d26ea5)（保存画面）、[21cb573e](https://github.com/synchro4351/udonarium_axe/commit/21cb573e)（HTML引用の秘匿修正）。リアクション入り本流`c5d53252`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-text-log)。HTMLの既存出力を残して`.txt`を追加し、読めない引用・返信先を両形式から除外。保存・同期形式は変えません。

画像スタンプ：[04978b94](https://github.com/synchro4351/udonarium_axe/commit/04978b94)（部屋保存）、[100e611e](https://github.com/synchro4351/udonarium_axe/commit/100e611e)（セットZIP入出力）、[fe4b5dba](https://github.com/synchro4351/udonarium_axe/commit/fe4b5dba)（メディア管理）、[acd82b59](https://github.com/synchro4351/udonarium_axe/commit/acd82b59)（送信とログ）、[9a54146d](https://github.com/synchro4351/udonarium_axe/commit/9a54146d)（選択画面と候補入力）。`.txt`ログ入り本流`21cb573e`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-stamps)。静止画像セットは部屋ZIPと参加者へ同期し、スタンプ発言は添付画像として旧版でも表示できます。画像データは部屋内へ共有されるため、秘密発言でも画像バイト自体は秘匿されません。検索語の保存・別端末への反映・保存ZIP再読込はユーザーが確認済み。弱回線試験は未実施です。

スタンプの使い勝手と絵文字表示：[66250c25](https://github.com/synchro4351/udonarium_axe/commit/66250c25)（独自の標準10個セット）、[33d91f3b](https://github.com/synchro4351/udonarium_axe/commit/33d91f3b)（画像一覧との共有・検索語の保存修正）、[34d6e3aa](https://github.com/synchro4351/udonarium_axe/commit/34d6e3aa)（スタンプ縮小・絵文字だけの発言を拡大）。`9a54146d`を基点に同じ機能ブランチで追加。標準素材は透過PNGとして同梱し、部屋ZIPへ重複保存しません。画面での修正後確認は利用者が完了。弱回線試験は未実施です。

標準セットの初期表示：[359c8941](https://github.com/synchro4351/udonarium_axe/commit/359c8941)。空の部屋ではスタンプ管理画面を開いた時に標準セットを表示。ChromiumのE2Eで標準セット、送信画像の大きさ、絵文字だけの拡大、追加直後の一覧、検索語保持を確認。ユーザーも保存ZIP再読込と別端末での検索語保持を確認済み。弱回線は未確認です。

スタンプ操作・読み上げ・ログ：[4c754de0](https://github.com/synchro4351/udonarium_axe/commit/4c754de0)（検索語先頭の読み上げ）、[9171d281](https://github.com/synchro4351/udonarium_axe/commit/9171d281)（「プリセット」への改名、検索語・チャットパレット候補、特殊記法、外側クリック、ログ表示）。`689a64c1`起点。`.txt`をログの種類から選び、HTMLログのスタンプ画像だけを縮小します。候補は明示選択するまで普通の文字入力を置き換えません。Chromiumのスタンプ操作1件、全943ファイル／13,036件成功・1件skip、production build成功。利用者が画面確認済みです。

キャラクター頭上の吹き出し：[82a18071](https://github.com/synchro4351/udonarium_axe/commit/82a18071)、[位置調整 d994fb16](https://github.com/synchro4351/udonarium_axe/commit/d994fb16)、[前面表示 a2999013](https://github.com/synchro4351/udonarium_axe/commit/a2999013)。同じ[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-stamps)で続けて実装。GMが部屋設定で有効にすると、引用された普通の発言、単独のスタンプ、絵文字だけの発言をキャラクター駒の上へ一時表示。設定は部屋ZIPと参加者へ同期し、吹き出し自体は保存しません。個別宛・秘密・閲覧不可タブ・システム発言は除外。利用者がローカル版でHPバー・バフの手前への表示と駒のドラッグを確認済み。弱回線は未確認です。

チャットタブ設定の文字ログ：[92d6f95b](https://github.com/synchro4351/udonarium_axe/commit/92d6f95b)。現在タブと全タブの保存形式に`.txt`を追加。利用者がローカル版で確認済みです。

ブラウザの名称：[38990bf4](https://github.com/synchro4351/udonarium_axe/commit/38990bf4)。タブ・PWAなどに`Udonarium Axe tyoitashi`を表示。保存・同期形式の変更はありません。

## r4以降の開発版

クリップボード画像の登録と背景色の透明化：[ca2e9532](https://github.com/synchro4351/udonarium_axe/commit/ca2e9532)。固定ソース`a2999013`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/clipboard-media-image)。メディアの画像一覧で貼り付けまたは単一ファイル選択後にプレビューし、指定色に近い画素を透過したコピーを登録できる。複数ファイル選択は従来どおり。保存形式を増やさず、既存の画像登録・同期経路を使う。全体949ファイル／13,133件成功・1件skip、production build成功。利用者がローカル画面・別端末・保存ZIPで確認済み。

単一画像ドロップの確認と連続取込：[4cf3254f](https://github.com/synchro4351/udonarium_axe/commit/4cf3254f)。`ca2e9532`から継続。ドロップ位置を保って透過確認後に追加できる。次の画像を取り込む際は確認中の画像を先に追加し、追加失敗時は保留する。保存・同期形式は不変。全体950ファイル／13,179件成功・1件skip、型検査・lint・整形・ビルド成功。利用者がローカル画面で確認済み。

短時間の反応エフェクト：[5e5dd408](https://github.com/synchro4351/udonarium_axe/commit/5e5dd408)。`4cf3254f`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/emoji-effects)。既存エフェクトへ「ぽんと出る」「対象へ投げる」「降らせる」の3種を追加し、絵文字・短い文字列・卓の画像を選べる。同期項目は`reactionText`と`reactionImageIdentifier`。旧設定は空欄として読める。対象574件、関連2,570件成功、型検査・lint・整形・ビルド成功。実画面・複数端末の目視は未確認。

キャラクター画像を差し込むカットイン：[4665bea5](https://github.com/synchro4351/udonarium_axe/commit/4665bea5)（実装）、[a8b9ef05](https://github.com/synchro4351/udonarium_axe/commit/a8b9ef05)（表示文言）。`5e5dd408`起点の[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/cutin-character-template)。発動時のキャラクター・画像IDと画像ごとの調整値を同期し、未設定時は内蔵シルエットを表示。既存の固定画像カットインは変更しない。型検査2経路、対象84件、コミット時の全13,219件成功・1件skip、lint・整形・ビルド成功。実画面・複数端末は未確認。録画からの動画書き出しは立ち絵差し込みに未対応。

反応エフェクトとカットインテンプレートの追加改善：[ccd1951a](https://github.com/synchro4351/udonarium_axe/commit/ccd1951a)（投げる演出の着地点を正立）、[9726a9cb](https://github.com/synchro4351/udonarium_axe/commit/9726a9cb)（立ち絵のGUI調整、発動者名の差し込み、文字単位の動き、「参戦！」見本）。`a8b9ef05`起点の[修正ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/cutin-feedback-20260929)。保存済みのカットインは変更しない。直接Vitestと`ng test`の両経路で953ファイル・13,250件成功、1件skip。カットイン操作E2E7件、型検査・lint・整形・本番ビルド成功。追加修正の実画面確認は未実施。録画の動画書き出しは新しい名前差し込みと文字単位の動きを再現しない。

立ち絵の位置合わせをキャラクターへ移動：[db8bc580](https://github.com/synchro4351/udonarium_axe/commit/db8bc580)（保存・同期・旧値の読込）、[7780fe26](https://github.com/synchro4351/udonarium_axe/commit/7780fe26)（キャラクターシートの操作画面）。`9726a9cb`起点の[修正ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/character-portrait-fit)。キャラクター・画像・輪郭の種類ごとに調整値を保持し、同じ輪郭の別カットインで再利用する。旧シーン別値は新しい値がない時だけ使う。顔・肩の輪郭が最初の種類で、全身用は未実装。直接Vitestと`ng test`で955ファイル・13,283件成功、1件skip。型検査・lint・整形・本番ビルド、キャラクターとカットインのE2E12件成功。新しい画面の目視と実端末同期は未確認。

立ち絵位置合わせの操作改善：[32f00d02](https://github.com/synchro4351/udonarium_axe/commit/32f00d02)（本流取り込み`5692865a`）。`7780fe26`起点の[操作改善ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/portrait-fit-ui)。ドラッグ位置を340×400枠の絶対座標で保持し、縮小時も指と同じ方向に動かせる。画像全体と表示枠を見せ、数値欄・スライダーを除いた。この時点では旧形式の値を保持して再生していたが、後続のr5では削除した。全955ファイル・13,300件成功、1件skip、lint・整形・本番ビルド成功。利用者は新しい操作画面を確認済み。

位置合わせの旧試験形式を削除：[ca139aef](https://github.com/synchro4351/udonarium_axe/commit/ca139aef)（本流取り込み`7033c85e`）。`5692865a`起点の[整理ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/portrait-fit-format-cleanup)。旧`{zoom,x,y}`の変換・再生分岐とシーン別の試験用調整値を除き、キャラクターに保存する`{scale,x,y}`に一本化した。旧試験値は既定表示となる。全955ファイル・13,299件成功、1件skip、型検査・lint・整形・本番ビルド成功。利用者は操作改善のローカル画面を確認済み。`7033c85e`はtyoitashi r5として個人版・デモ版に同じアーカイブで配備済み。

## 検証と制限

- r4の固定ソース`a2999013`は、全体947ファイル／13,084件成功・1件skip、production build成功。r3の固定ソース`cf5edecf`は全体929ファイル／12,712件成功・1件skip、production build成功。r2の固定ソース`6e5668dd`は全体927ファイル／12,680件成功・1件skip、production build成功。
- 2026-09-26に、ユーザーが前候補のカットイン見本とカード操作の確認表9項目を合格と報告。一覧から引く操作と演出調整もユーザーが合格を報告。低い「Level UP」と手札アイコンもユーザーが確認済み。手札の通常のセーブ・ロードと同じタブでの再接続は動作したが、既存卓へのZIP再読込でカード複製が報告されている。弱回線試験は未確認。
- フォント選択・YouTube表示・ポインター入力を組み合わせた92件は、r1で直接Vitest・Angular経由の両方に成功。自動再生追加は対象22件を両経路で確認。
- 初回ドラッグはChromium・Firefox・WebKitで、チャットフォーカスあり／なしの計6件を確認。
- 再読み込み後の同一ID再参加・双方向通信・再同期は確認済み。旧接続が残る場合は約1分待ち、他の参加者の強制退出やID変更はしない。
- 実YouTube動画の再生、すべてのOSのフォント表示、Flyの全保存データの互換性を保証するものではない。

## 公式へ採用済みの変更

カード表面の文章は公式v1.48.0へ採用済みです。[元ブランチ](https://github.com/synchro4351/udonarium_axe/tree/feature/card-face-text)の13f2d72e・d28e814fは参照用で、現在の独自機能には数えていません。公式側で文字色・拡大表示・画像素材などの調整が加わっています。

## 取り込みについて

参照・再利用はMITライセンスの範囲で歓迎します。採用やレビューをお願いするものではありません。表の基点には別機能も含まれるため、必要な変更を選び、取り込み先の公式バージョンで改めて検証してください。今の変更一覧を、依存関係のないパッチ集として扱わないでください。
