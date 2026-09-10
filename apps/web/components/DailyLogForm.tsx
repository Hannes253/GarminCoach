"use client";

import { useState, useTransition } from "react";
import { saveDailyLog } from "@/lib/actions/manualFields";

export interface DailyLogFormProps {
  logDate: string; // YYYY-MM-DD
  initialSleepHours: number | null;
  initialSleepQuality: number | null;
  initialNote: string | null;
}

export function DailyLogForm({ logDate, initialSleepHours, initialSleepQuality, initialNote }: DailyLogFormProps) {
  const [sleepHours, setSleepHours] = useState(initialSleepHours != null ? String(initialSleepHours) : "");
  const [sleepQuality, setSleepQuality] = useState(
    initialSleepQuality != null ? String(initialSleepQuality) : "",
  );
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await saveDailyLog(
        logDate,
        sleepHours === "" ? null : Number(sleepHours),
        sleepQuality === "" ? null : Number(sleepQuality),
        note.trim() || null,
      );
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <span className="text-sm font-medium">Schlaf letzte Nacht</span>
      <div className="flex gap-2">
        <label className="flex flex-1 items-center gap-2 text-xs">
          <span className="shrink-0">Stunden</span>
          <input
            type="number"
            step="0.5"
            min="0"
            max="14"
            value={sleepHours}
            onChange={(e) => {
              setSleepHours(e.target.value);
              setSaved(false);
            }}
            className="w-16 rounded border border-black/10 bg-background px-2 py-1 dark:border-white/20"
          />
        </label>
        <label className="flex flex-1 items-center gap-2 text-xs">
          <span className="shrink-0">Qualität</span>
          <select
            value={sleepQuality}
            onChange={(e) => {
              setSleepQuality(e.target.value);
              setSaved(false);
            }}
            className="rounded border border-black/10 bg-background px-2 py-1 dark:border-white/20"
          >
            <option value="">–</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        placeholder="Notiz (optional)"
        className="rounded border border-black/10 bg-background px-2 py-1 text-xs dark:border-white/20"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Speichert…" : saved ? "Gespeichert" : "Speichern"}
      </button>
    </div>
  );
}
