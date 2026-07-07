"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthState } from "@/lib/auth/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <div className="card p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">ログイン</h1>
      <p className="mb-5 text-sm text-slate-500">アカウントにサインインしてください。</p>

      <form action={action} className="space-y-3">
        <div>
          <label className="label">メールアドレス</label>
          <input name="email" type="email" required className="input" placeholder="you@company.com" />
        </div>
        <div>
          <label className="label">パスワード</label>
          <input name="password" type="password" required className="input" />
        </div>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "サインイン中…" : "ログイン"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        アカウントをお持ちでない場合は{" "}
        <Link href="/signup" className="text-brand-600 hover:underline">
          新規登録
        </Link>
      </p>
    </div>
  );
}
