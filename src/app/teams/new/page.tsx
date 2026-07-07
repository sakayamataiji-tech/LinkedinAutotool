import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { createTeamAction } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const session = await requireAuth();
  const hasTeams = session.memberships.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="card p-6">
          <h1 className="mb-1 text-lg font-semibold text-slate-900">新しいチームを作成</h1>
          <p className="mb-5 text-sm text-slate-500">
            チームごとにキャンペーン・リード・受信箱が分離されます。
          </p>
          <form action={createTeamAction} className="space-y-3">
            <div>
              <label className="label">チーム名</label>
              <input name="name" required className="input" placeholder="採用チーム" />
            </div>
            <button type="submit" className="btn-primary w-full">
              作成する
            </button>
          </form>
        </div>
        {hasTeams ? (
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-slate-500 hover:underline">
              ← 戻る
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
