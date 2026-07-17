"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { switchTeamAction, logoutAction } from "@/lib/auth/actions";

interface TeamItem {
  id: string;
  name: string;
  role: string;
}

export function Topbar({
  user,
  teams,
  activeTeamId,
}: {
  user: { name: string; email: string };
  teams: TeamItem[];
  activeTeamId: string | null;
}) {
  const active = teams.find((t) => t.id === activeTeamId) ?? teams[0];
  const [teamOpen, setTeamOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setTeamOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header
      ref={ref}
      className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6"
    >
      {/* Team switcher */}
      <div className="relative">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => {
            setTeamOpen((v) => !v);
            setUserOpen(false);
          }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-100 text-xs font-bold text-brand-700">
            {active?.name.slice(0, 1) ?? "?"}
          </span>
          {active?.name ?? "チーム未選択"}
          <span className="text-slate-400">▾</span>
        </button>
        {teamOpen ? (
          <div className="absolute left-0 top-11 z-20 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <div className="px-2 py-1 text-xs font-medium text-slate-400">チームを切り替え</div>
            {teams.map((t) => (
              <button
                key={t.id}
                disabled={pending}
                onClick={() => start(() => switchTeamAction(t.id))}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                  t.id === active?.id ? "text-brand-700" : "text-slate-700"
                }`}
              >
                <span>{t.name}</span>
                <span className="text-xs text-slate-400">{t.role}</span>
              </button>
            ))}
            <div className="my-1 border-t border-slate-100" />
            <a href="/teams/new" className="block rounded-lg px-2 py-2 text-sm text-brand-600 hover:bg-slate-50">
              + 新しいチームを作成
            </a>
          </div>
        ) : null}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => {
            setUserOpen((v) => !v);
            setTeamOpen(false);
          }}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
            {user.name.slice(0, 1)}
          </span>
          <span className="hidden text-slate-700 sm:inline">{user.name}</span>
        </button>
        {userOpen ? (
          <div className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <div className="px-2 py-2">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-400">{user.email}</div>
            </div>
            <div className="my-1 border-t border-slate-100" />
            <form action={logoutAction}>
              <button
                type="submit"
                className="block w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
