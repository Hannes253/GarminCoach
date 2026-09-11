"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateAndSaveTrainingPlan } from "@/lib/actions/plan";

export function GeneratePlanButton({ hasPlan }: { hasPlan: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await generateAndSaveTrainingPlan();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Plan-Erstellung fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Erstellt…" : hasPlan ? "Plan neu berechnen" : "Plan erstellen"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
