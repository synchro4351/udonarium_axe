# Udonarium_Axe_tyoitashi

> [!IMPORTANT]
> このリポジトリは、[Udonarium Axe](https://github.com/Xelltis/udonarium_axe)を基盤に個人利用向けの機能を追加するフォークです。公式版ではありません。

## このフォークの方針

- 当面の開発基準は、公式Axe v1.50.0の[`7a4692c2`](https://github.com/Xelltis/udonarium_axe/commit/7a4692c200f94edfd3514ef1ce095ef7ba26865e)です。公式更新は監視しますが、互換性確認と採用判断なしに基準を進めません。
- 汎用的な追加機能は、一機能ごとに固定基準から独立したブランチとして実装します。私家統合版の差分を機能ブランチへ混ぜません。
- 現在、上流への機能提案IssueやPull Requestは原則として送りません。公開ブランチは、必要な方がMITライセンスの範囲で参照・cherry-pickできる形に保ちます。採用やレビューを求めるものではありません。
- 通常利用向けの全機能版は[`codex/synwork-integration`](https://github.com/synchro4351/udonarium_axe/tree/codex/synwork-integration)で管理し、機能ブランチから一方向に統合します。

## 追加機能ブランチ

| 機能 | 状態 | ブランチ | 基準・補足 |
| --- | --- | --- | --- |
| カード表面への文章 | 公式v1.48.0へ採用済み・参照用 | [`feature/card-face-text`](https://github.com/synchro4351/udonarium_axe/tree/feature/card-face-text) | 旧提案ブランチ。今後の拡張には使用しません |
| チャット読み上げ | 実装済み・私家統合版へ統合済み | [`codex/chat-speech`](https://github.com/synchro4351/udonarium_axe/tree/codex/chat-speech) | ブラウザのSpeechSynthesisを利用する端末ローカル設定 |
| マップマスク文章・縁取り | 実装済み・重点検証済み | [`codex/map-mask-text`](https://github.com/synchro4351/udonarium_axe/tree/codex/map-mask-text) | Fly互換を考慮。保存ZIPと2クライアント実通信の手動確認は未完了 |
| カード文章の縁取り | 開発中 | [`codex/card-text-outline`](https://github.com/synchro4351/udonarium_axe/tree/codex/card-text-outline) | 初期実装を公開。視認性調整と最終検証を継続中 |

ブランチを新しく作成した時点で、この表へ機能名・状態・ブランチ・基準を追加します。実装、検証、私家統合、公式採用、保留または廃止の判断が変わった場合も状態を更新し、過去の公開ブランチは用途が分かるように記録を残します。

### 今後の候補

- カットイン・テキストレイヤーのフォント選択
- カットイン・帯レイヤーのグラデーション設定表示の修正
- セッション用依頼・Todoリスト
- 主観ビューモード、3Dオブジェクト配置（低優先度）
- 外部AIツール向けAPI（安全な権限設計を先に行うため後回し）

---

## ベースプロジェクト: Udonarium Axe

[![Latest release](https://img.shields.io/github/v/release/Xelltis/udonarium_axe?logo=github)](https://github.com/Xelltis/udonarium_axe/releases/latest)
[![Release](https://github.com/Xelltis/udonarium_axe/actions/workflows/release.yml/badge.svg)](https://github.com/Xelltis/udonarium_axe/actions/workflows/release.yml)
[![Docs](https://img.shields.io/badge/Docs-利用ガイド-5C73E7?logo=vitepress&logoColor=white)](https://xelltis.github.io/udonarium_axe/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **AXE** — Adventure. eXperience. Encore.
> 冒険を。経験に。もう一度。

Udonarium Axe は、ブラウザ上で動作する TRPG オンラインセッション支援ツールです。
テーブル上のオブジェクト（コマ・カード・ダイスなど）は WebRTC（SkyWay SDK v2）の P2P 通信で
ブラウザ間に直接同期され、ゲームデータが中央サーバーに保存されることはありません。

[Udonarium](https://github.com/TK11235/udonarium)（TK11235）を源流とし、その派生である
[Udonarium Lily](https://github.com/entyu/udonarium_lily)（entyu）の機能・コードを受け継いでいます。
そのうえで実装基盤を Angular 22 / Zoneless + Signals で作り直し、独自の機能を加えました。

> 動作推奨環境は **デスクトップ版 Chrome** です。スマートフォンからの操作は十分にサポートされていません。

## 必要なもの（バックエンドが要ります）

ゲームデータ自体はブラウザ同士の P2P でやり取りしますが、その P2P 接続を確立するには
SkyWay の **認証トークン** が要ります。トークンは SkyWay の App ID / Secret で署名して発行するもので、
Secret をブラウザに置くわけにはいきません。そのため、**トークンを発行する小さなバックエンドを 1 つ用意する** 必要があります。

```
ブラウザ (Udonarium Axe) ──┬─→ バックエンド（トークン発行のみ）──→ SkyWay
                           │
                           └────────── P2P (WebRTC) ──────────→ 他のプレイヤーのブラウザ
```

つまり遊ぶには次の 3 つが必要です。

1. **SkyWay アカウント**（App ID / Secret。無料枠あり）
2. **バックエンド**（トークン発行用。下記から 1 つ選んでデプロイ）
3. **フロントエンド本体**（この成果物を静的ホスティングに配置）

※ 接続情報パネルの「オンライン／オフライン」でオフラインを選ぶと、SkyWay もバックエンドも使わずに単独のブラウザで動きます。他の人とはつながりません。選択はそのブラウザに残り、オンラインに戻すと通信を始めます。

## クイックスタート

1. **SkyWay でアプリを作成**
   [SkyWay](https://skyway.ntt.com/) でアカウントを作成し、アプリケーションを 1 つ作成して
   **App ID** と **Secret** を控えます。

2. **バックエンドをデプロイ**
   下の [バックエンドの選択肢](#バックエンドの選択肢) から 1 つ選んでデプロイし、次の環境変数を設定します。
   - `SKYWAY_APP_ID` … 手順 1 の App ID
   - `SKYWAY_SECRET` … 手順 1 の Secret
   - `ACCESS_CONTROL_ALLOW_ORIGIN` … Axe を公開する URL（例: `https://your-axe.example.com`。`*` で全許可）

   ブラウザや `curl` で `https://<バックエンドのURL>/v1/status` を開き、`OK` が返れば成功です。

3. **フロントエンドを配置**
   [Releases](https://github.com/Xelltis/udonarium_axe/releases) の `axe_x.y.z.zip` を展開し
   （または自分でビルドした `dist/` を使い）、中身を任意の静的ホスティング
   （Cloudflare Pages / Amazon S3 / レンタルサーバー など）に置きます。

4. **接続先を設定**
   配置したファイルの `assets/config.json` を開き、`backend.url` を手順 2 のバックエンド URL に書き換えます。

   ```json
   {
     "backend": {
       "url": "https://<バックエンドのURL>"
     }
   }
   ```

5. **Chrome で開く**
   配置先の URL をデスクトップ版 Chrome で開き、ルームを作成すればセッションを開始できます。
   同じ URL を共有された参加者が同じルームに入ると、テーブルが同期されます。

## バックエンドの選択肢

いずれも Axe が呼び出す API（`GET /v1/status`・`POST /v1/skyway2023/token`）に対応しており、そのまま利用できます。
必要な環境変数（`SKYWAY_APP_ID` / `SKYWAY_SECRET` / `ACCESS_CONTROL_ALLOW_ORIGIN`）も共通です。

| バックエンド                                                                    | 実装 / 配置先                                               | こんな人に                                   | デプロイ方法                                                |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| [udonarium-backend-vercel](https://github.com/Xelltis/udonarium-backend-vercel) | TypeScript (Hono) / **Vercel Edge**                         | とにかく手軽に始めたい                       | ◎ README の **Deploy with Vercel** ボタンから               |
| [udonarium_axe_backend](https://github.com/Xelltis/udonarium_axe_backend)       | **PHP 8.3 / Apache**                                        | レンタルサーバーを持っている                 | ○ Releases の zip を展開し `.env` を設定して docroot に配置 |
| [udonarium-backend（本家）](https://github.com/TK11235/udonarium-backend)       | TypeScript (Hono) / Cloudflare Workers・AWS Lambda・Node.js | CF Workers / Lambda / 自前 Node で運用したい | ○ 各環境に自前でデプロイ（CLI）                             |

> 本家 [TK11235/udonarium-backend](https://github.com/TK11235/udonarium-backend) も **そのまま利用できます**。
> Axe が呼び出す API（`GET /v1/status`・`POST /v1/skyway2023/token`、レスポンス `{ "token": ... }`）と
> 完全に同一の仕様です。Cloudflare Workers・AWS Lambda・Node.js のいずれかにデプロイしてください。

## 主な機能

テーブル（地形・マップ）、キャラクターコマ、カード／山札、ダイス（[BCDice](https://github.com/bcdice/BCDice)）、
チャットとダイスボット、立ち絵差分、カットイン、投票、タイマー／アラーム、インベントリといった
Udonarium の基本は、そのまま使えます。

Axe で足したのは、遊びを進める側の道具です。移動範囲と ZOC を敷いて経路を決めてから動かす移動、
ラウンドと陣営を回す部屋設定、盤面で再生するマップ演出、マップエディターとダンジョン生成、
壁面サーフェスと 2D／3D の切り替え、ココフォリアやキャラクター保管所などからのキャラ取り込み、
リプレイと自動保存、モバイル表示。画面を寝かせて卓を囲む卓上ディスプレイ向けの表示も、
その画面だけの設定として入っています。

何がどう動くかは [利用ガイド](https://xelltis.github.io/udonarium_axe/) に、
足した機能の一覧と設計の理由は [docs/features.md](docs/features.md) にまとめてあります。

## 名前について

**A**dventure. e**X**perience. **E**ncore. — 冒険を、経験に、もう一度。

卓の一晩は終わりますが、記録から読み物や動画やまとめとして呼び戻せます。

## 系譜とクレジット

本プロジェクトは以下の MIT ライセンス作品の系譜にあります（詳細は [LICENSE](LICENSE)）。
Lily で追加された立ち絵差分・カットイン・バフ／デバフ管理・画像タグ等のコードを継承し、
実装基盤を現行 Angular で作り直したうえで独自機能を加えています。
Lycoris はコードの継承元ではなく、ホットバーの着想を得た作品として挙げています。

| 作品                  | 作者                      | リポジトリ                                      | 位置づけ                                     |
| --------------------- | ------------------------- | ----------------------------------------------- | -------------------------------------------- |
| **Udonarium**         | TK11235                   | <https://github.com/TK11235/udonarium>          | オリジナル                                   |
| **Udonarium Lily**    | entyu（円柱）             | <https://github.com/entyu/udonarium_lily>       | 派生・機能拡張版（画像タグ等のコードを継承） |
| **Udonarium Lycoris** | oron1208                  | <https://github.com/oron1208/udonarium-lycoris> | 着想元（ホットバー）。コードの継承はなし     |
| **Udonarium Axe**     | SavageChieftain / Xelltis | <https://github.com/Xelltis/udonarium_axe>      | 本リポジトリ                                 |

> 注: 上記の機能の切り分けは本リポジトリの LICENSE・コード・公開情報を根拠にした暫定整理です。

### 取り込ませていただいた仕事

系譜とは別に、フォークや提案として作られた機能を本リポジトリへ取り込んでいます。
コミットは著者名もハッシュもそのまま残しています。

| 機能                                                                                                                                      | 作者        | 出どころ                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| **卓上ディスプレイ**（2D 多方向閲覧・回転メニュー・外周ティッカー・多方向カットイン・実寸表示）、**レイヤー**（盤面の下と上を流れる背景） | okamichi    | <https://github.com/okamichi/udonarium_axe/tree/2d-multi-view>             |
| **カード文章**（カードの面に文字を重ねる）                                                                                                | synchro4351 | <https://github.com/synchro4351/udonarium_axe/tree/feature/card-face-text> |

設定の置き場や保存先は取り込みにあたって変えたものがありますが、機能そのものは各作者の設計と実装によります。

## 開発

```sh
npm install        # 依存インストール
npm start          # 開発サーバー（ng serve）
npm run build      # プロダクションビルド（dist/ と axe_x.y.z.zip を生成）
npm test           # ユニットテスト（Vitest）
npm run lint       # ESLint
npm run e2e        # Playwright E2E
```

盤面や UI だけを手元で見るときは、開発サーバーを起動して開いたあと、接続情報パネルで
「オフライン」を選んでください。SkyWay へつなぎに行かないので、バックエンドを立てなくても
1 つのブラウザの中で操作できます。通信するときは「オンライン」に戻します。

開発サーバーは既定で SkyWay バックエンドの URL を `assets/config.json`（`http://localhost:3000`）から読み込みます。
ローカルで動かす場合はバックエンドをローカル起動するか、`assets/config.json` を公開済みバックエンドに向けてください。

詳細な開発規範は以下を参照してください。

| ドキュメント                                           | 内容                               |
| ------------------------------------------------------ | ---------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                 | 開発規範の最小セット（まずはここ） |
| [docs/features.md](docs/features.md)                   | Axe で追加・拡張した機能の一覧     |
| [docs/multi-angle.md](docs/multi-angle.md)             | 2D 多方向閲覧と外周ティッカー      |
| [docs/architecture.md](docs/architecture.md)           | 7 層アーキテクチャと設計思想       |
| [docs/coding-guidelines.md](docs/coding-guidelines.md) | コーディング規範・コードスタイル   |
| [docs/contribution.md](docs/contribution.md)           | コミット規約・lefthook フック      |

## ライセンス

[MIT License](LICENSE) — 上記すべての先行作品の著作権表示を含みます。

同梱素材（画像・効果音）の帰属は [src/assets/copyright.txt](src/assets/copyright.txt) に
1 ファイルでまとめています。形式は Debian machine-readable copyright format 1.0（DEP-5）で、
ライセンス名には SPDX 短縮識別子を使っています。
