# カットインの演出見本を外部配布にする

「演出見本を追加」の選択欄と「見本16個のZIP」のリンクは、卓の画面に出すには主張が強いため、アプリから外した。16個の見本はZIPとして、リポジトリの`examples/`から配るだけにする。

## 基点・ブランチ

- 基点：`70fbd8b1028be73806b83a367d0f7a7caf259176`
- ブランチ：`codex/cutin-external-examples`（専用worktree）

## 変更の内容

- カットイン一覧：テンプレートの選択欄とZIPのダウンロードリンクを削除。
- `cut-in-scene-templates.ts`と専用のテストを削除。16個を作るコードがアプリに残らない。初期のSample1・Sample2・Sample_Templateは別の`builtin-cut-ins.ts`が作るので、そのまま。
- ja/en/koの翻訳キー：`sceneTemplatePick`、`sceneTemplate_*`（16個）、`characterExamples`、`reactionExamples`、`examplePack`、`examplePackHint`を削除。
- `src/assets/samples/tyoitashi-cut-in-examples.zip`をアプリの配布物から外した。`examples/tyoitashi-cut-ins.zip`に移す。
- `scripts/package-cut-in-examples.mjs`：出力先を`examples/tyoitashi-cut-ins.zip`に変更。XML16個だけを、ファイル名順・固定の更新日時で収める。
- 旧テンプレートを検証の材料にしていたテストとE2Eは、小さな組み立て済みの値、またはSample_Templateへ置き換えた。

## 保存形式・既存データ

保存形式・属性・同期は変えない。16個のXMLは今までと同じ通常のカットインXML。すでに読み込んだ見本、利用者が作ったカットイン、初期のSample1・Sample2・Sample_Templateには触れない。ただし、以前のバージョンで「演出見本を追加」から作った見本は、保存済みの通常のカットインとして残る。

## 検証

関連Vitest・型検査・変更箇所lintが成功。CodexでAngularの一覧テスト12件と、ZIPの再生成・内容照合・CRC・再現性を補完し、すべて成功した。確認の観点は次の4つ。

- ZIPの16エントリーが、`examples/tyoitashi-cut-ins/`の16個のXMLと完全に同じバイト列で読み戻せること、CRCが一致すること。
- 同じXMLからスクリプトを2回実行して、同一のZIPになること。
- 初期の3見本が変わらないこと（`builtin-cut-ins.spec.ts`、E2Eの`cut-in-samples`）。
- 一覧、シーンエディタ、ポスターフレーム、翻訳の関連Vitest。

## 依存・制限

- 新しい依存パッケージは追加しない。ZIPの生成は既存のfflateを使う。
- `CutInFreshSceneService`はシーンエディタ側に残した。テンプレートからの作成が無くなり、現在はテストだけが印を付ける。次にエディタを整理するときに外せる。
- 外部配布のURLは、公開GitHubのraw URLになる予定。ルートREADMEへのリンクはまとめ役が入れる。
- 以前のバージョンから更新した部屋では、見本の選択欄が消える。ZIPからの読み込みは、通常の卓データと同じ操作。

## ルートREADMEへの案

> ### カットインの演出見本
> 追加の演出見本16個は、アプリには含めていません。[examples/tyoitashi-cut-ins.zip](https://github.com/synchro4351/udonarium_axe/raw/main/examples/tyoitashi-cut-ins.zip)を保存し、カットインを読み込む操作と同じようにZIPを卓へ読み込むと追加できます。画像や音声は含まず、通常のカットインとして編集できます。

公開索引のmainにも同じZIPとXMLを配置する。
