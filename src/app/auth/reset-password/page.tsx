"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#EF9F27]";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login?auth=error");
        return;
      }
      setReady(true);
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== confirm) {
      setError("Hasła muszą być identyczne.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace("/app");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1A1A1A] text-white/50">
        Ładowanie…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A1A1A] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-8">
        <h1 className="mb-2 text-2xl font-semibold text-white">Nowe hasło</h1>
        <p className="mb-6 text-sm text-white/50">Ustaw nowe hasło do konta FUELED.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nowe hasło"
            className={inputCls}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Powtórz hasło"
            className={inputCls}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#EF9F27] py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {loading ? "Zapisywanie…" : "Zapisz hasło"}
          </button>
        </form>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}
