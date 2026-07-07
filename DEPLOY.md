# デプロイ手順（Vercel + Neon Postgres）

このアプリを **Vercel**（ホスティング）と **Neon**（PostgreSQL）で公開する手順です。
所要時間は約15分。あなたが手を動かすのはクリック中心で、コードの変更は不要です。

> 前提：GitHubにこのリポジトリがある（済み）。当面は `LINKEDIN_PROVIDER=mock` で公開します
> （実際のLinkedIn自動操作はVercel＝サーバーレスでは動きません。後述）。

---

## ステップ1：Neon でデータベースを作る（5分）

1. https://neon.tech にアクセスし、**GitHubでサインアップ/ログイン**
2. 「**Create a project**」→ リージョンは `Asia Pacific (Singapore)` などお好みで → Create
3. プロジェクト作成後の「**Connection Details**」パネルで、接続文字列の種類を **「Prisma」** タブに切り替える
4. 表示される **2つの値**をコピーしておく（次のステップで使う）：
   - `DATABASE_URL`（`-pooler` が含まれるプール接続）
   - `DIRECT_URL`（直接接続）

> Neonの「Prisma」プリセットは、このアプリに必要な形の2つのURLをそのまま出してくれます。

---

## ステップ2：Vercel にリポジトリをインポート（3分）

1. https://vercel.com にアクセスし、**GitHubでログイン**
2. 「**Add New… → Project**」
3. リポジトリ一覧から **`LinkedinAutotool`** を選び「**Import**」
4. Framework は自動で **Next.js** と認識されます（そのままでOK）

---

## ステップ3：環境変数を設定（3分）

Import画面の「**Environment Variables**」で以下を追加します（コピペでOK）：

| Name | Value | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | Neonの `DATABASE_URL`（poolerの方） | 実行時のDB接続 |
| `DIRECT_URL` | Neonの `DIRECT_URL` | マイグレーション用 |
| `CRON_SECRET` | 適当なランダム文字列（例：`openssl rand -hex 24` の出力／長めのパスワードでも可） | 自動実行の保護＆Vercel Cron認証 |
| `LINKEDIN_PROVIDER` | `mock` | 当面はモックで公開 |

> `CRON_SECRET` を設定すると、Vercel Cron が `/api/cron/run` を呼ぶ際に自動で
> `Authorization: Bearer <CRON_SECRET>` を付けてくれます（このアプリはそれを検証します）。

---

## ステップ4：ビルドコマンドを設定（1分）

デプロイ時に自動でDBマイグレーションを流すため、ビルドコマンドを上書きします。

1. Import画面（または後から Project → **Settings → Build & Development Settings**）
2. 「**Build Command**」の Override をオンにして、次を入力：

```
prisma migrate deploy && next build
```

> `prisma generate` は `postinstall` で自動実行されるので不要です。

---

## ステップ5：デプロイ

「**Deploy**」を押す → 数分でビルド＆公開されます。完了すると `https://<プロジェクト名>.vercel.app` が発行されます。

---

## ステップ6：最初のアカウントを作る

1. 公開URL（`https://….vercel.app`）を開くと `/login` にリダイレクトされます
2. 「新規登録」から **あなたのアカウントとチームを作成**（メール／パスワード／チーム名）
3. ダッシュボードに入れれば成功です 🎉

> ⚠️ `npm run db:seed`（デモデータ投入）は **既存データを全削除する破壊的操作**です。
> 本番では実行しないでください。上記のサインアップで新規に始めれば不要です。

---

## ステップ7：自動実行（スケジューラ）の確認

- リポジトリ同梱の `vercel.json` により、**10分ごとに `/api/cron/run` が自動実行**されます
  （キャンペーンのシーケンス進行・返信検知・Webhook配信）。
- Vercel の Project → **Settings → Cron Jobs** で登録状況を確認できます。
- 手動で今すぐ動かしたい時は、アプリの「設定 → 今すぐ全キャンペーンを実行」ボタンでもOKです。

---

## 以降の更新

GitHub の `main` に取り込む（PRをマージする）と、**Vercelが自動で再デプロイ**します。
`claude/...` ブランチへのpushでも**プレビュー環境**が自動作成されます。

---

## 注意・制限

- **実際のLinkedIn自動操作（Playwright）はVercelでは動きません**（サーバーレスに常駐ブラウザを置けないため）。
  本番で実自動化する場合は、その部分だけ **Railway / Render / VPS** のワーカーに載せ、同じNeon DBを共有する構成にします（別途ご案内できます）。
- 無料枠：Neon・Vercelとも無料枠で開始できます。アクセス/データが増えたら有料プランへ。

## トラブルシューティング

- **ビルドでDB接続エラー** → `DIRECT_URL` が正しいか、Neonのプロジェクトが起動しているか確認。
- **画面は出るがデータ操作でエラー** → `DATABASE_URL`（pooler）が正しいか確認。
- **Cronが動かない** → `vercel.json` があるか、Settings → Cron Jobs に登録があるか、`CRON_SECRET` を設定したか確認。
