import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#1A1A1A] px-6 text-white/50">
          Ładowanie…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
