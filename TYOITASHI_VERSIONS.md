# tyoitashiのバージョン履歴

[紹介ページ](README.md) · [機能別の変更とコミット](TYOITASHI_CHANGES.md)

公式Axeの番号と私家版の番号を分け、**tyoitashi rN／Axe vX.Y.Z**と表記します。rNは利用版を固定するたびに増やす通し番号で、Axeの基準を更新してもリセットしません。文書だけの修正や開発ブランチの作成では増やしません。

この番号は2026-09-24から導入した、固定コミットに対する私家版の識別名です。GitHub Release・Gitタグ・アプリ内のバージョン表示とは別であり、現時点では公式由来のpackage.jsonや配布ZIP名を変更していません。どの版かを厳密に確認する場合はコミットを参照してください。

## tyoitashi r3／Axe v1.57.1 — 2026-09-26

次版の開発ソースは[発言ごとの絵文字リアクション](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-reactions)、[チャットログの`.txt`保存](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-text-log)、[画像スタンプ](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-stamps)を追加しています。r3の通常VPSには含みません。

- 固定ソース：[cf5edecf](https://github.com/synchro4351/udonarium_axe/tree/cf5edecf309aa245d974737fc8b5486e6131faac)
- r2を基点に、GMによる不在手札の引継ぎと自分の手札カードのホバー詳細を追加しました。新しい保存・同期項目はありません。
- 全体929ファイル／12,712件成功・1件skip、production build成功。通常版VPSのWebを更新し、配信・コンテナ状態を確認済みです。手札ホバー詳細の目視は未確認です。最新の保存・再読込ではカード複製は見られませんでしたが、以前に報告された既存卓へZIPを重ねて読み込む条件は再確認が必要です。弱回線試験も後日実施します。
- [r2からの差分](https://github.com/synchro4351/udonarium_axe/compare/6e5668dd5b71ce7071be8dcbd9dd120da25aa7b1...cf5edecf309aa245d974737fc8b5486e6131faac)

## tyoitashi r2／Axe v1.57.1 — 2026-09-26

- 固定ソース：[6e5668dd](https://github.com/synchro4351/udonarium_axe/tree/6e5668dd5b71ce7071be8dcbd9dd120da25aa7b1)
- 公式基準：[Axe v1.57.1 / 85c89f98](https://github.com/Xelltis/udonarium_axe/commit/85c89f98ec11f2a82cb0b7bcbcf54351496d4457)
- YouTubeカットイン開始時に自動再生を要求します。ブラウザの制限下では手動操作が必要です。
- ホットバーのエフェクト選択に図形アイコンと名称を併記しました。
- 編集可能なカットイン見本を15種に拡充しました。透明背景・短時間で、丸・星・裂けた帯などの図形を使い分けます。外部画像・音声は不要です。文字位置、帯内の光、低くした「Level UP」の矢印も調整しました。保存済みのカットインの内容は変えません。
- 手札の参加者間受け渡し、本人による公開・秘匿切替、ローカル自動ソート、直前の渡し主表示を追加しました。手札一覧から他人のカードをドラッグで引けます。従来の専用画面は廃止しました。PC・モバイルの手札メニューには星付きカードの独自アイコンを使います。
- 公開設定は参加者情報で同期し、ルームセーブには含めません。渡し主ID・名前はカードの保存・同期項目として追加。ソート設定はブラウザ内に保存し、共有handOrderは自動ソートで変更しません。渡し主情報が捨て札・山札へ残る消去漏れも修正済みです。
- 公開前の確認と公開状態表示、公開手札の一覧、カードのドロップ位置を決めてから表裏を選ぶ操作、山札の枚数・厚さ表示更新を追加しました。手札の初回表示と更新通知、部屋単位の公開方式、カード編集権限、場・山札からの受け渡しも含みます。
- ユーザーは2026-09-26に手札一覧から引く操作とカットイン見本の調整まで目視確認済みです。低い「Level UP」と手札アイコンもユーザーが目視確認済みです。全体927ファイル／12,680件成功・1件skip、production build成功。手札の通常のセーブ・ロードと同じタブでの再接続はユーザーが確認済みですが、既存卓への保存ZIP再読込ではカードの複製が報告されています。弱回線での実動作と山札の通信遅延そのものの解消は未確認です。
- [r1からの差分](https://github.com/synchro4351/udonarium_axe/compare/be1fdb8a81037efab6300ad49260023552e87739...6e5668dd5b71ce7071be8dcbd9dd120da25aa7b1)

## tyoitashi r1／Axe v1.57.1 — 2026-09-24

既存の利用版に初めて識別名を付けたものです。この命名のための再配備は行っていません。

- 固定ソース：[be1fdb8a](https://github.com/synchro4351/udonarium_axe/tree/be1fdb8a81037efab6300ad49260023552e87739)
- 公式基準：[Axe v1.57.1 / 85c89f98](https://github.com/Xelltis/udonarium_axe/commit/85c89f98ec11f2a82cb0b7bcbcf54351496d4457)
- チャット読み上げ、カードの縁取り、マップマスクの文章・縁取り・白い既定文字色、再参加待機を含みます。
- 今回追加した内容：カットインのフォント選択、YouTube再生操作の修正、チャット入力後の初回ドラッグ修正。
- 確認：関連92件を直接Vitest・Angular経由で成功、初回ドラッグを3ブラウザで計6件成功、全体12,520件成功・1件skip、production build成功。
- 実卓採用試験はユーザーより完了報告あり。個別機能、とくに実YouTube再生の目視完了を意味するものではありません。
- [公式基準からの全差分](https://github.com/synchro4351/udonarium_axe/compare/85c89f98ec11f2a82cb0b7bcbcf54351496d4457...be1fdb8a81037efab6300ad49260023552e87739)

## 番号導入前

旧v1.50系の機能ブランチと履歴は残しています。現在の公式基準へそのまま適用できることを保証するものではありません。再利用の入口は[機能別の対応表](TYOITASHI_CHANGES.md)をご覧ください。
