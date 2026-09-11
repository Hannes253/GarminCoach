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
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-[var(--radius-card)] bg-card">
        <label className="flex items-center justify-between border-b border-separator px-4 py-3">
          <span className="text-[15px]">Renndatum</span>
          <input
            type="date"
            value={raceDate}
            onChange={(e) => {
              setRaceDate(e.target.value);
              setSaved(false);
            }}
            className="bg-transparent text-right text-[15px] text-muted focus:text-foreground focus:outline-none"
          />
        </label>
        <label className="flex items-center justify-between px-4 py-3">
          <span className="text-[15px]">Rennname</span>
          <input
            type="text"
            value={raceName}
            onChange={(e) => {
              setRaceName(e.target.value);
              setSaved(false);
            }}
            placeholder="z. B. Berlin Marathon"
            className="w-40 bg-transparent text-right text-[15px] placeholder:text-muted focus:outline-none"
          />
        </label>
      </div>

      {error && <p className="px-1 text-xs text-danger">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending || raceDate === ""}
        className="tap-shrink rounded-xl bg-accent py-2.5 text-[15px] font-semibold text-accent-foreground disabled:opacity-50"
      >
        {isPending ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
      </button>
    </div>
  );
}
