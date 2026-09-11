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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="tap-shrink rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Erstellt…" : hasPlan ? "Neu berechnen" : "Plan erstellen"}
      </button>
      {error && <p className="max-w-[14rem] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
