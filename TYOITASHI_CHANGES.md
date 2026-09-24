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

## 検証と制限

- 現在の次版候補は全体922ファイル／12,520件成功・1件skip、production build成功。
- フォント選択・YouTube表示・ポインター入力を組み合わせた92件は、r1で直接Vitest・Angular経由の両方に成功。自動再生追加は対象22件を両経路で確認。
- 初回ドラッグはChromium・Firefox・WebKitで、チャットフォーカスあり／なしの計6件を確認。
- 再読み込み後の同一ID再参加・双方向通信・再同期は確認済み。旧接続が残る場合は約1分待ち、他の参加者の強制退出やID変更はしない。
- 実YouTube動画の再生、すべてのOSのフォント表示、Flyの全保存データの互換性を保証するものではない。

## 公式へ採用済みの変更

カード表面の文章は公式v1.48.0へ採用済みです。[元ブランチ](https://github.com/synchro4351/udonarium_axe/tree/feature/card-face-text)の13f2d72e・d28e814fは参照用で、現在の独自機能には数えていません。公式側で文字色・拡大表示・画像素材などの調整が加わっています。

## 取り込みについて

参照・再利用はMITライセンスの範囲で歓迎します。採用やレビューをお願いするものではありません。表の基点には別機能も含まれるため、必要な変更を選び、取り込み先の公式バージョンで改めて検証してください。今の変更一覧を、依存関係のないパッチ集として扱わないでください。
