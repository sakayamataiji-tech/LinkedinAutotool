"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type AuthState } from "@/lib/auth/actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signupAction, {});

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">新規登録</h1>
      <p className="mb-5 text-sm text-slate-500">アカウントとチームを作成します。</p>

      <form action={action} className="space-y-3">
        <div>
          <label className="label">お名前</label>
          <input name="name" required className="input" placeholder="山田 太郎" />
        </div>
        <div>
          <label className="label">メールアドレス</label>
          <input name="email" type="email" required className="input" placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">パスワード（8文字以上）</label>
          <input name="password" type="password" required minLength={8} className="input" />
        </div>
        <div>
          <label className="label">チーム名</label>
          <input name="teamName" required className="input" placeholder="営業チーム" />
        </div>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "作成中…" : "アカウントを作成"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        既にアカウントをお持ちの場合は{" "}
        <Link href="/login" className="text-brand-600 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  );
}
