# 公式との差分・再利用のための変更一覧

[紹介ページ](README.md) · [版ごとの履歴](TYOITASHI_VERSIONS.md)

比較対象は公式Axe v1.57.1（85c89f98）です。ここでは元の機能コミットを示します。後から公式の構造変更に合わせた調整もあるため、現在の実装はr1または次版の固定ソースと併せて確認してください。

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
| YouTube自動再生（次版） | [42bdbd97](https://github.com/synchro4351/udonarium_axe/commit/42bdbd97) | be1fdb8a起点。f45a18c5の再生操作修正を前提とする。開始時にiframe生成・autoplay要求、既存の時刻合わせと操作欄を維持 |
| ホットバーのエフェクトアイコン（次版） | [2a75e5c2](https://github.com/synchro4351/udonarium_axe/commit/2a75e5c2) | 42bdbd97起点。既存のeffect-shapesのSVGとng-selectを使用。保存値は従来のエフェクト名のまま |
| 編集可能なカットイン見本3種（次版） | [13e18a3f](https://github.com/synchro4351/udonarium_axe/commit/13e18a3f) | 2a75e5c2の後続。既存のCutIn・シーン・レイヤー・アニメーションプリセットを使用。既存カットインに不干渉、保存・同期形式を追加しない |

[小改善2件の機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/hotbar-effect-icons-and-cutin-presets)は、公式v1.57.1に私家機能を加えた42bdbd97を基点としています。

手札の受け渡し（次版）：[929eec63](https://github.com/synchro4351/udonarium_axe/commit/929eec63ca7c1f6424106b0c15a6256a12e95a99)、[機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/card-player-transfer)。基点は上記2件を含む1c285e05。既存のCardGameServiceと手札UIへ追加し、既存のCard.toHandで移動するため保存・同期の新項目はありません。実行直前に手札の所在・操作側ロール・受取人を再確認します。公開手札・自動ソート・配布元表示は含みません。

手札の公開・秘匿（次版）：[5a0cc8e4](https://github.com/synchro4351/udonarium_axe/commit/5a0cc8e4)。929eec63起点。公開設定はPeerCursorの同期値で、既定秘匿・再接続時も秘匿。ルームセーブ対象外です。

自動ソート（次版）：[d9a3280a](https://github.com/synchro4351/udonarium_axe/commit/d9a3280a)。表示順だけを端末ごとに切り替え、共有のhandOrderは変更しません。設定はブラウザ内に保存します。

直前の渡し主（次版）：[da07bbd8](https://github.com/synchro4351/udonarium_axe/commit/da07bbd8)、[消去経路修正 15189c35](https://github.com/synchro4351/udonarium_axe/commit/15189c35)。Cardに渡し主ID・名前の保存・同期項目を追加。明示的な受け渡しで更新し、手札から出ると消します。旧セーブには項目がありません。これらは[同じ機能ブランチ](https://github.com/synchro4351/udonarium_axe/tree/codex/card-hand-visibility-sort-provenance)の後続コミットで、929eec63以降の私家機能を含みます。

## 検証と制限

- 現在の次版候補は全体924ファイル／12,540件成功・1件skip、production build成功（機能ブランチの検証済みコミットと同一）。
- カード追加機能の2クライアント実動作・画面目視・セーブ再読込は未確認。自動テストの成功と区別しています。
- エフェクト選択欄とカットイン見本の実画面・演出は目視未確認。
- フォント選択・YouTube表示・ポインター入力を組み合わせた92件は、r1で直接Vitest・Angular経由の両方に成功。自動再生追加は対象22件を両経路で確認。
- 初回ドラッグはChromium・Firefox・WebKitで、チャットフォーカスあり／なしの計6件を確認。
- 再読み込み後の同一ID再参加・双方向通信・再同期は確認済み。旧接続が残る場合は約1分待ち、他の参加者の強制退出やID変更はしない。
- 実YouTube動画の再生、すべてのOSのフォント表示、Flyの全保存データの互換性を保証するものではない。

## 公式へ採用済みの変更

カード表面の文章は公式v1.48.0へ採用済みです。[元ブランチ](https://github.com/synchro4351/udonarium_axe/tree/feature/card-face-text)の13f2d72e・d28e814fは参照用で、現在の独自機能には数えていません。公式側で文字色・拡大表示・画像素材などの調整が加わっています。

## 取り込みについて

参照・再利用はMITライセンスの範囲で歓迎します。採用やレビューをお願いするものではありません。表の基点には別機能も含まれるため、必要な変更を選び、取り込み先の公式バージョンで改めて検証してください。今の変更一覧を、依存関係のないパッチ集として扱わないでください。
