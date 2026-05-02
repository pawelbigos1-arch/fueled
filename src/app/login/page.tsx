"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getPublicSiteUrl } from "@/lib/site-url";

function signInErrorMessage(message: string): string {
  if (message.trim() === "email rate limit exceeded") {
    return "Za dużo wiadomości na ten adres — poczekaj chwilę albo sprawdź SMTP w Supabase.";
  }
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!cancelled && user) router.replace("/app");
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const p = new URLSearchParams(window.location.search);
      if (p.get("auth") !== "error") return;
      setError(
        "Nie udało się potwierdzić logowania — link mógł wygasnć albo został użyty. Wyślij nowy Magic Link."
      );
      window.history.replaceState(null, "", window.location.pathname);
    } catch {}
  }, []);

  const handleMagicLinkLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const site = getPublicSiteUrl(window.location.origin);
    const redirectTo = `${site}/auth/callback`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signInError) {
      setError(signInErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    setMessage("Wysłaliśmy Magic Link na Twój e-mail.");
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A1A1A] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-8">
        <h1 className="mb-8 text-3xl font-semibold tracking-wide text-white">FUELED</h1>
        <form onSubmit={handleMagicLinkLogin} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@twojadomena.com"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#EF9F27]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#EF9F27] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Wysyłanie..." : "Wyślij Magic Link"}
          </button>
          {message ? <p className="text-sm text-green-400">{message}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
