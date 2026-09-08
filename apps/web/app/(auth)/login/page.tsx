"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackError() {
  const searchParams = useSearchParams();
  if (searchParams.get("error") !== "auth") return null;

  return (
    <p className="text-sm text-red-600">
      Login-Link ist ungültig oder abgelaufen (z. B. schon einmal geöffnet). Bitte neuen Link
      anfordern.
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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-xl font-semibold">GarminCoach</h1>

      <Suspense fallback={null}>
        <CallbackError />
      </Suspense>

      {status === "sent" ? (
        <p className="text-center text-sm text-foreground/70">
          Login-Link verschickt an {email}. Bitte E-Mail-Postfach prüfen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
          <input
            type="email"
            required
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/20"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {status === "sending" ? "Sende Link…" : "Login-Link senden"}
          </button>
          {status === "error" && (
            <p className="text-sm text-red-600">
              Login-Link konnte nicht verschickt werden. Bitte erneut versuchen.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
