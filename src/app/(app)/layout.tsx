import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { requireAuth } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Enforces authentication for the whole app surface.
  const session = await requireAuth();
  const activeTeamId =
    session.memberships.find((m) => m.teamId === session.activeTeamId)?.teamId ??
    session.memberships[0]?.teamId ??
    null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Topbar
          user={session.user}
          activeTeamId={activeTeamId}
          teams={session.memberships.map((m) => ({ id: m.teamId, name: m.team.name, role: m.role }))}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
