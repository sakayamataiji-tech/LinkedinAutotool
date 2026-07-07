# LinkedIn Autotool

LinkedIn上での営業・採用・リード獲得活動を効率化・自動化するアウトリーチ支援ツールの **MVP 基盤**。

見込み顧客・採用候補者の発掘から、接続リクエスト、メッセージ / InMail / メールによるアプローチ、
フォローアップ、返信管理、成果分析までを一気通貫で扱えるプラットフォームの土台です。

> **本リポジトリの現状**: MVP 基盤 + コア機能。実際の LinkedIn 操作は **モックプロバイダ**（差し替え可能な
> インターフェース）で再現しており、UI・データモデル・シーケンス実行エンジンをアカウント無しで
> エンドツーエンドに動作確認できます。

## 技術スタック

- **Next.js 15**（App Router / Server Actions） + **React 19** + **TypeScript**
- **Prisma** + **PostgreSQL**
- **Tailwind CSS**

## 実装済みの機能

| 領域 | 内容 |
| --- | --- |
| 認証・マルチテナント | メール/パスワードのサインアップ・ログイン・ログアウト、DBセッション＋httpOnly Cookie、チーム切替、テナント分離、メンバー招待 |
| ダッシュボード | 全キャンペーン横断の接続承認率・返信率・リード数・最近のアクティビティ |
| キャンペーン管理 | 作成 / 実行 / 一時停止・再開、ステータス内訳、日次推移グラフ、CSVエクスポート |
| リード取り込み | CSVアップロード（列自動マッピング・テンプレート配布）、プロフィールURL貼り付け、各種ソース（LinkedIn検索/Sales Navigator/Recruiter/イベント参加者/いいね・コメントユーザー/1次接続）からの取り込み。氏名クリーニング・重複排除・タグ付与・キャンペーン登録に対応 |
| リード管理（簡易CRM） | 検索・タグ絞り込み、プロフィール情報、メモ、ブラックリスト、キャンペーン進捗履歴、アクティビティ履歴 |
| シーケンスビルダー | アクション / 待機 / 条件分岐ノードを積み上げるビジュアルフロー、テンプレート保存 |
| 受信箱 | 会話一覧（未読 / 重要 / アーカイブ絞り込み）、スレッド表示、返信、重要マーク |
| 設定 | 1日あたりのアクション上限、タイムゾーン / 稼働時間、連携アカウント、Webhook |
| 実行エンジン | シーケンスグラフを1ノードずつ進行。アクション実行・条件評価・待機スケジュール・日次上限制御 |
| 自動実行スケジューラ | 稼働中キャンペーンを自動進行。曜日ごとの稼働時間＋タイムゾーンを尊重。cronエンドポイント / インプロセス常駐 / ポーラーの3方式、手動「今すぐ実行」 |
| 返信検知・自動一時停止 | リードから返信が来たら自動でそのリードのシーケンスを停止（機械的な追撃を防止）。スケジューラが稼働時間に関係なく返信をポーリング。受信箱「返信あり」フィルタ、返信バッジ |
| Webhook実配信 | イベント発生時に外部システムへ HMAC-SHA256 署名付きでPOST配信。タイムアウト＋リトライ、配信ログ記録、テスト送信、購読イベント選択、署名シークレット自動生成 |
| メッセージテンプレート | 再利用可能な文面ライブラリ（種別・件名・本文）。シーケンス作成時に本文を挿入 |
| A/Bテスト | メッセージノードに複数バリアントを設定し、リードごとに決定論的（重み付き）に均等割当。送信メッセージにバリアントを記録し、バリアント別の送信数・返信率を計測 |

### 対応アクション / 条件

- **アクション**: 接続リクエスト、メッセージ、InMail、プロフィール閲覧、スキル推薦、フォロー、投稿いいね、
  メールアドレス検索、メール送信、接続リクエスト取り消し
- **条件分岐**: 接続済みか / メッセージ閲覧済みか / メール取得済みか / オープンプロフィールか

## アーキテクチャ

```
src/
├── middleware.ts           # 認証ガード（Cookie有無でリダイレクト、Edge）
├── app/
│   ├── layout.tsx          # ルートレイアウト（html/body）
│   ├── (auth)/             # 未認証向け: /login, /signup
│   ├── (app)/              # 認証必須（サイドバー＋上部バー）
│   │   ├── layout.tsx      # requireAuth() ＋ チーム切替バー
│   │   ├── page.tsx        # ダッシュボード
│   │   ├── campaigns/      # キャンペーン一覧・詳細
│   │   ├── leads/          # リードCRM 一覧・詳細
│   │   ├── sequences/      # シーケンス一覧・ビルダー
│   │   ├── inbox/          # 受信箱
│   │   └── settings/       # 設定（上限/連携/Webhook/メンバー）
│   ├── teams/new/          # チーム作成
│   └── api/                # CSVエクスポート等
├── components/             # UIコンポーネント（サーバー/クライアント）
└── lib/
    ├── prisma.ts           # Prisma クライアント
    ├── session.ts          # 認証必須化＋現在チーム解決（テナント分離の要）
    ├── actions.ts          # Server Actions（各種ミューテーション）
    ├── engine.ts           # シーケンス実行エンジン
    ├── metrics.ts          # 成果指標・日次推移の集計
    ├── text.ts             # 敬称/学位/絵文字の除去・テンプレート差し込み
    ├── auth/               # 認証層
    │   ├── password.ts     # scrypt ハッシュ/検証
    │   ├── session.ts      # セッション/Cookie 管理
    │   └── actions.ts      # signup/login/logout/switchTeam/invite
    └── linkedin/           # 差し替え可能なプロバイダ層
        ├── provider.ts     # LinkedInProvider インターフェース
        ├── mock.ts         # モック実装（決定論的な擬似結果）
        └── index.ts        # getProvider()
```

**プロバイダ差し替え**: `src/lib/linkedin/index.ts` の `getProvider()` を実装差し替えするだけで、
ブラウザ自動化や外部API連携などの本番プロバイダに移行できます（エンジン・UIは無変更）。

## 自動実行スケジューラ

稼働中キャンペーンを、各チームの**タイムゾーン**と**曜日ごとの稼働時間**の範囲内で自動進行します
（`src/lib/schedule.ts`）。3通りの起動方式に対応：

| 方式 | 用途 | 設定 |
| --- | --- | --- |
| Cronエンドポイント | Vercel等のサーバーレス | `vercel.json` の cron が `/api/cron/run` を定期実行。`CRON_SECRET` で保護 |
| インプロセス常駐 | `next start` / セルフホスト | `ENABLE_INPROCESS_SCHEDULER=true`（`SCHEDULER_INTERVAL_MS` で間隔調整） |
| ポーラー | ローカル / 外部cron | `npm run scheduler`（`BASE_URL` / `CRON_SECRET` / `INTERVAL_SECONDS`） |

- `/api/cron/run` は `Authorization: Bearer <CRON_SECRET>` または `?secret=` を要求（未設定時は開放）。
- `?force=1` で稼働時間を無視して即実行。設定画面の「今すぐ全キャンペーンを実行」も同様。

## Webhook

イベント発生時に登録済みWebhookへ署名付きでPOSTします（`src/lib/webhooks.ts`）。

- **イベント**: `connection.accepted` / `message.sent` / `message.replied` / `campaignLead.completed`
  （購読リスト空 = 全イベント）。テスト送信は `ping`。
- **署名**: `X-LA-Signature: sha256=<hex>` ヘッダ（Web Crypto の HMAC-SHA256、Webhookごとの
  シークレット）。受信側は body と共有シークレットで検証可能。
- **配送**: 5秒タイムアウト＋最大3回リトライ。各試行を `WebhookDelivery` に記録し、設定画面に
  「最近の配信」として表示。配信失敗はシーケンス実行を止めません。
- その他ヘッダ: `X-LA-Event`, `X-LA-Delivery`（配信ID）。

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. .env に PostgreSQL 接続情報を設定
cp .env.example .env
#   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/linkedinautotool?schema=public"

# 3. マイグレーション & Prisma Client 生成
npm run db:migrate

# 4. デモデータ投入
npm run db:seed

# 5. 開発サーバー起動
npm run dev
# http://localhost:3000
```

### デモログイン

シード投入後、以下でログインできます（未認証は自動的に `/login` へリダイレクト）。

- **Email**: `sakayama.taiji@zeeta.co.jp` / **Password**: `password123`（2チームに所属）
- **Email**: `member@zeeta.co.jp` / **Password**: `password123`

## 認証・マルチテナント

- **認証**: メール/パスワード。パスワードは Node 標準 `crypto` の scrypt でハッシュ化（外部依存なし）。
  サーバー側 `Session` テーブルを httpOnly Cookie で参照。
- **ガード**: `middleware.ts` が Cookie 有無で `/login` 等へ振り分け（Edge）。実際の検証は
  各ページ/アクションの `requireAuth()` がサーバー側で実施。
- **マルチテナント**: ユーザーは `Membership` で複数チームに所属。`getCurrentTeam()` がセッションの
  `activeTeamId` から現在のチームを解決し、**全データクエリを `teamId` で分離**。上部バーの
  チーム切替でアクティブチームを変更でき、切替後は別チームのデータが一切表示されない（分離を確認済み）。
- **メンバー**: 設定画面から登録済みユーザーをメール招待（MVPでは既存ユーザーの紐付け）。

## 動作確認済みの主要フロー

- 全ページ（ダッシュボード / キャンペーン / リード / シーケンス / 受信箱 / 設定）がレンダリング
- シーケンス実行エンジンが「プロフィール閲覧 → 接続リクエスト → 待機 → 接続済み判定 → メッセージ →
  待機 → フォローアップ」を各リードについて進行し、会話・メッセージ・アクティビティを生成
- 日次上限（DailyLimit）によるアクション数の制御
- CSV エクスポート

## A/Bテスト

メッセージノード（MESSAGE / INMAIL / SEND_EMAIL）に `MessageVariant`（A/B/C…、重み付き）を
設定すると、各リードは `hash(leadId + nodeId)` により重み付きで**決定論的に**バリアントへ割り当て
られます（同じリードは常に同じバリアント）。送信された `Message` に `variantId` を記録し、
`src/lib/ab.ts` の `sequenceVariantStats()` がバリアント別の送信数・返信数・返信率を集計して
ビルダーに表示します（`src/lib/engine.ts` の `pickVariant`）。

## 今後の拡張ポイント

- 本番 LinkedIn プロバイダ実装（各ソースからの実データ取り込み）
- CSV取り込みの列マッピングを手動調整するプレビュー画面
- A/Bテストの統計的有意差判定（現状は素の返信率比較）
- バックグラウンドスケジューラ（cron / queue）による自動実行
- リード取り込み（各種ソース連携・CSVアップロードUI）
- Webhook 配信の実処理、稼働時間ウィンドウの実行時判定
