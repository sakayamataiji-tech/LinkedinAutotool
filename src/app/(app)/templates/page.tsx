import { prisma } from "@/lib/prisma";
import { getCurrentTeamId } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { TemplateManager } from "@/components/TemplateManager";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const teamId = await getCurrentTeamId();
  const templates = await prisma.messageTemplate.findMany({
    where: { teamId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="メッセージテンプレート"
        subtitle="よく使うメッセージ文面を保存。メッセージの流れを作るときに挿入できます。"
      />
      <TemplateManager
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          subject: t.subject,
          body: t.body,
        }))}
      />
    </div>
  );
}
