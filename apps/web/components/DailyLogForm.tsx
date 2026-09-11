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
    <div className="overflow-hidden rounded-2xl bg-card">
      <p className="px-4 pt-3.5 text-xs font-medium uppercase tracking-wide text-muted">Schlaf letzte Nacht</p>

      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <span className="text-[15px]">Stunden</span>
        <input
          type="number"
          step="0.5"
          min="0"
          max="14"
          placeholder="–"
          value={sleepHours}
          onChange={(e) => {
            setSleepHours(e.target.value);
            setSaved(false);
          }}
          className="w-16 bg-transparent text-right text-[15px] text-muted placeholder:text-muted focus:text-foreground focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between border-b border-separator px-4 py-3">
        <span className="text-[15px]">Qualität</span>
        <select
          value={sleepQuality}
          onChange={(e) => {
            setSleepQuality(e.target.value);
            setSaved(false);
          }}
          className="bg-transparent text-right text-[15px] text-muted focus:text-foreground focus:outline-none"
        >
          <option value="">–</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} / 5
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="Notiz (optional)"
          className="w-full bg-transparent text-[15px] placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="px-4 pb-3.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="tap-shrink w-full rounded-xl bg-accent py-2.5 text-[15px] font-semibold text-accent-foreground disabled:opacity-50"
        >
          {isPending ? "Speichert…" : saved ? "Gespeichert ✓" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
