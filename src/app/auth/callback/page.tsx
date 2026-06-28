"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Obsługa potwierdzenia emaila po rejestracji (PKCE ?code=) oraz legacy OTP.
 * Logowanie email+hasło nie wymaga tej strony — tylko link z maila potwierdzającego.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      router.replace("/login");
      return;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      isSingleton: false,
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
      },
    });

    const finish = (ok: boolean, recovery = false) => {
      if (ok && recovery) {
        router.replace("/auth/reset-password");
        return;
      }
      if (ok) router.replace("/app");
      else {
        setStatus("error");
        router.replace("/login?auth=error");
      }
    };

    /** Licznik użytkowników — synch z `user_profiles` (route.ts zająłby to samo `auth/callback` co `page.tsx` w Next.js). */
    async function upsertUserProfileIntoDirectory() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { error } = await supabase.from("user_profiles").upsert(
          { id: user.id, email: user.email ?? "" },
          { onConflict: "id" }
        );
        if (error) console.error("[auth callback] user_profiles:", error.message);
      } catch (e) {
        console.error("[auth callback] user_profiles:", e);
      }
    }

    const run = async () => {
      const search = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const code = search.get("code");
      const tokenHash = search.get("token_hash") ?? hashParams.get("token_hash");
      const typeRaw = search.get("type") ?? hashParams.get("type");
      const isRecovery = typeRaw === "recovery";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && !isRecovery) await upsertUserProfileIntoDirectory();
        finish(!error, isRecovery);
        return;
      }

      if (tokenHash && typeRaw) {
        const { error } = await supabase.auth.verifyOtp({
          type: typeRaw as EmailOtpType,
          token_hash: tokenHash,
        });
        if (!error && typeRaw !== "recovery") await upsertUserProfileIntoDirectory();
        finish(!error, typeRaw === "recovery");
        return;
      }

      for (let i = 0; i < 5; i += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await upsertUserProfileIntoDirectory();
          finish(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 120));
      }

      finish(false);
    };

    void run();
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-[#1A1A1A] px-6 text-white">
      <p className="text-sm">
        {status === "working" ? "Trwa logowanie…" : "Nie udało się zalogować."}
      </p>
    </main>
  );
}
