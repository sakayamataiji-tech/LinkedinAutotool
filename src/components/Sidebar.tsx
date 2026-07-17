"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "ダッシュボード", icon: "▚" },
  { href: "/analytics", label: "分析", icon: "▨" },
  { href: "/campaigns", label: "アプローチ施策", icon: "◎" },
  { href: "/leads", label: "リード管理", icon: "☰" },
  { href: "/sequences", label: "メッセージの流れ", icon: "⇄" },
  { href: "/templates", label: "テンプレート", icon: "▤" },
  { href: "/inbox", label: "受信箱", icon: "✉" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          in
        </div>
        <div className="text-sm font-semibold leading-tight text-slate-900">
          LinkedIn
          <br />
          <span className="text-slate-400">Autotool</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="w-4 text-center text-slate-400">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
        MVP · Mockプロバイダ稼働中
      </div>
    </aside>
  );
}
