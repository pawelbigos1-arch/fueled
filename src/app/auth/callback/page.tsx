"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Magic link often returns tokens in URL hash (#…) — the server never sees that.
 * Route Handlers that redirect on "missing code" break this flow. Client handles
 * PKCE ?code=, ?token_hash=&type=email, and implicit hash tokens via detectSessionInUrl.
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

    const finish = (ok: boolean) => {
      if (ok) router.replace("/app");
      else {
        setStatus("error");
        router.replace("/login?auth=error");
      }
    };

    const run = async () => {
      const search = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const code = search.get("code");
      const tokenHash = search.get("token_hash") ?? hashParams.get("token_hash");
      const typeRaw = search.get("type") ?? hashParams.get("type");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        finish(!error);
        return;
      }

      if (tokenHash && typeRaw) {
        const { error } = await supabase.auth.verifyOtp({
          type: typeRaw as EmailOtpType,
          token_hash: tokenHash,
        });
        finish(!error);
        return;
      }

      for (let i = 0; i < 5; i += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
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
