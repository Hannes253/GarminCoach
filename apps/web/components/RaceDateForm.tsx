"use client";

import { useState, useTransition } from "react";
import { saveRaceDate } from "@/lib/actions/settings";

export interface RaceDateFormProps {
  initialRaceDate: string | null;
  initialRaceName: string | null;
}

export function RaceDateForm({ initialRaceDate, initialRaceName }: RaceDateFormProps) {
  const [raceDate, setRaceDate] = useState(initialRaceDate ?? "");
  const [raceName, setRaceName] = useState(initialRaceName ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await saveRaceDate(raceDate || null, raceName.trim() || null);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Renndatum</span>
        <input
          type="date"
          value={raceDate}
          onChange={(e) => {
            setRaceDate(e.target.value);
            setSaved(false);
          }}
          className="rounded border border-black/10 bg-background px-2 py-1.5 dark:border-white/20"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Rennname (optional)</span>
        <input
          type="text"
          value={raceName}
          onChange={(e) => {
            setRaceName(e.target.value);
            setSaved(false);
          }}
          placeholder="z. B. Berlin Marathon"
          className="rounded border border-black/10 bg-background px-2 py-1.5 dark:border-white/20"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || raceDate === ""}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Speichert…" : saved ? "Gespeichert" : "Speichern"}
      </button>
    </div>
  );
}
