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
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-[15px] font-medium">{SPORT_LABELS[activity.sport] ?? activity.sport}</div>
          <div className="text-xs text-muted">
            {formatDate(activity.startTime)}
            {activity.rpe != null && ` · RPE ${activity.rpe}`}
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          {activity.distanceMeters != null && (
            <div className="text-[15px] font-medium text-foreground">
              {(activity.distanceMeters / 1000).toFixed(2)} km
            </div>
          )}
          <div>{formatDuration(activity.durationSeconds)}</div>
          {pace && <div>{pace}</div>}
          {activity.avgHr != null && <div>{activity.avgHr} bpm</div>}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-fill p-3">
          <label className="flex items-center justify-between text-[13px]">
            <span>RPE (1–10)</span>
            <select
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              className="rounded-lg bg-card px-2.5 py-1.5 text-[13px]"
            >
              <option value="">–</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg bg-card px-2.5 py-1.5 text-[13px] placeholder:text-muted focus:outline-none"
            placeholder="Notiz, z. B. Seitenstechen ab km 8"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="tap-shrink self-start rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
