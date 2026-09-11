"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth") return null;

  return (
    <p className="text-[13px] text-danger">
      Login-Link ist ungültig oder abgelaufen (z. B. schon einmal geöffnet). Bitte neuen Link anfordern.
    </p>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="safe-top safe-bottom flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22%] bg-accent text-2xl font-bold text-accent-foreground">
          GC
        </div>
        <h1 className="text-2xl font-bold tracking-tight">GarminCoach</h1>
        <p className="text-[13px] text-muted">Dein persönlicher Marathon-Trainings-Coach</p>
      </div>

      <Suspense fallback={null}>
        <CallbackError />
      </Suspense>

      {status === "sent" ? (
        <div className="w-full max-w-xs rounded-2xl bg-card p-4 text-center text-[15px] text-muted">
          Login-Link verschickt an {email}. Bitte E-Mail-Postfach prüfen.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-2xl bg-card px-4 py-3 text-[15px] placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="tap-shrink rounded-2xl bg-accent px-4 py-3 text-[15px] font-semibold text-accent-foreground disabled:opacity-50"
          >
            {status === "sending" ? "Sende Link…" : "Login-Link senden"}
          </button>
          {status === "error" && (
            <p className="text-center text-[13px] text-danger">
              Login-Link konnte nicht verschickt werden. Bitte erneut versuchen.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
