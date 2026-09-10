"use client";

import { useState, useTransition } from "react";
import { saveActivityManualFields } from "@/lib/actions/manualFields";

const SPORT_LABELS: Record<string, string> = {
  run: "Laufen",
  bike: "Rad",
  strength: "Kraft",
  other: "Sonstiges",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(secPerKm: number | null): string | null {
  if (!secPerKm) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface ActivityRowData {
  id: string;
  sport: string;
  startTime: string;
  distanceMeters: number | null;
  durationSeconds: number;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  rpe: number | null;
  note: string | null;
}

export function ActivityRow({ activity }: { activity: ActivityRowData }) {
  const [expanded, setExpanded] = useState(false);
  const [rpe, setRpe] = useState(activity.rpe != null ? String(activity.rpe) : "");
  const [note, setNote] = useState(activity.note ?? "");
  const [isPending, startTransition] = useTransition();
  const pace = formatPace(activity.avgPaceSecPerKm);

  function handleSave() {
    startTransition(async () => {
      await saveActivityManualFields(activity.id, rpe === "" ? null : Number(rpe), note.trim() || null);
      setExpanded(false);
    });
  }

  return (
    <div className="py-2">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left text-sm"
      >
        <div>
          <div className="font-medium">{SPORT_LABELS[activity.sport] ?? activity.sport}</div>
          <div className="text-xs text-foreground/50">
            {formatDate(activity.startTime)}
            {activity.rpe != null && ` · RPE ${activity.rpe}`}
          </div>
        </div>
        <div className="text-right text-xs text-foreground/70">
          {activity.distanceMeters != null && <div>{(activity.distanceMeters / 1000).toFixed(2)} km</div>}
          <div>{formatDuration(activity.durationSeconds)}</div>
          {pace && <div>{pace}</div>}
          {activity.avgHr != null && <div>{activity.avgHr} bpm</div>}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-black/5 p-3 dark:bg-white/5">
          <label className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">RPE (1-10)</span>
            <select
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="rounded border border-black/10 bg-background px-2 py-1 dark:border-white/20"
            >
              <option value="">–</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0">Notiz</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 rounded border border-black/10 bg-background px-2 py-1 dark:border-white/20"
              placeholder="z. B. Seitenstechen ab km 8"
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="self-start rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-50"
          >
            {isPending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
