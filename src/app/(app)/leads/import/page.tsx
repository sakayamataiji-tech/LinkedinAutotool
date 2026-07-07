import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import { CsvImport, UrlImport, SourceImport } from "@/components/LeadImport";

export const dynamic = "force-dynamic";

export default async function ImportLeadsPage() {
  const teamId = await getCurrentTeamId();
  const campaigns = await prisma.campaign.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <div className="mb-2">
        <Link href="/leads" className="text-xs text-slate-400 hover:text-slate-600">
          ← リード一覧
        </Link>
      </div>
      <PageHeader
        title="リードの取り込み"
        subtitle="さまざまな情報源からリードを追加。氏名の敬称・絵文字は自動除去、重複は自動スキップされます。"
      />

      <div className="space-y-6">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm text-brand-700">
              ⬆
            </span>
            <h2 className="text-sm font-semibold text-slate-700">CSVファイル</h2>
          </div>
          <CsvImport campaigns={campaigns} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm text-brand-700">
              🔗
            </span>
            <h2 className="text-sm font-semibold text-slate-700">プロフィールURL</h2>
          </div>
          <UrlImport campaigns={campaigns} />
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm text-brand-700">
              🔍
            </span>
            <h2 className="text-sm font-semibold text-slate-700">検索結果・参加者リスト</h2>
          </div>
          <SourceImport campaigns={campaigns} />
        </Card>
      </div>
    </div>
  );
}
