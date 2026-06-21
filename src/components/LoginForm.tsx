"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/auth-messages";
import { getPublicSiteUrl } from "@/lib/site-url";

type Mode = "login" | "register";

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-[#EF9F27]";

async function upsertUserProfile(userId: string, email: string) {
  const supabase = createClient();
  await supabase.from("user_profiles").upsert(
    { id: userId, email },
    { onConflict: "id" }
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("mode") === "register") setMode("register");
  }, [searchParams]);

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
    const auth = searchParams.get("auth");
    if (auth === "error") {
      setError("Nie udało się potwierdzić konta — spróbuj ponownie lub zarejestruj się.");
    } else if (auth === "confirmed") {
      setMessage("Email potwierdzony. Możesz się zalogować.");
      setMode("login");
    }
  }, [searchParams]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(authErrorMessage(signInError.message));
      setLoading(false);
      return;
    }

    if (data.user) {
      await upsertUserProfile(data.user.id, data.user.email ?? email.trim());
    }

    router.replace("/app");
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setError("Podaj imię.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const site = getPublicSiteUrl(window.location.origin);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${site}/auth/callback`,
        data: { full_name: trimmedName },
      },
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError.message));
      setLoading(false);
      return;
    }

    if (data.session && data.user) {
      await upsertUserProfile(data.user.id, data.user.email ?? trimmedEmail);
      router.replace("/app");
      return;
    }

    setMessage(
      "Konto utworzone. Sprawdź email i kliknij link potwierdzający, potem zaloguj się."
    );
    setPassword("");
    setMode("login");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1A1A1A] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-black/20 p-8">
        <h1 className="mb-6 text-3xl font-semibold tracking-wide text-white">FUELED</h1>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
              mode === "login"
                ? "border-[#EF9F27]/60 bg-[#EF9F27]/15 text-[#fff3e8]"
                : "border-white/15 text-white/60"
            }`}
          >
            Logowanie
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
              mode === "register"
                ? "border-[#EF9F27]/60 bg-[#EF9F27]/15 text-[#fff3e8]"
                : "border-white/15 text-white/60"
            }`}
          >
            Rejestracja
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (login)"
              className={inputCls}
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hasło"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#EF9F27] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Logowanie…" : "Zaloguj się"}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Imię"
              className={inputCls}
            />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (login)"
              className={inputCls}
            />
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hasło (min. 6 znaków)"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#EF9F27] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Tworzenie konta…" : "Zarejestruj się"}
            </button>
            <p className="text-center text-[11px] text-white/40">
              Wyślemy link potwierdzający na podany email.
            </p>
          </form>
        )}

        {message ? <p className="mt-4 text-sm text-green-400">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </div>
    </main>
  );
}
