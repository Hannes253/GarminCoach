import type { Database } from "@/lib/supabase/types.generated";

type PhaseRow = Pick<
  Database["public"]["Tables"]["plan_phases"]["Row"],
  "id" | "phase_type" | "start_date" | "end_date" | "target_weekly_volume_km"
>;

const PHASE_LABELS: Record<PhaseRow["phase_type"], string> = {
  base: "Grundlage",
  build: "Aufbau",
  specific: "Spezifisch",
  taper: "Taper",
};

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00.000Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PlanMacrocycle({ phases }: { phases: PhaseRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      {phases.map((phase) => (
        <div
          key={phase.id}
          className="flex items-center justify-between rounded-md border border-black/10 p-2 text-sm dark:border-white/10"
        >
          <div>
            <p className="font-medium">{PHASE_LABELS[phase.phase_type]}</p>
            <p className="text-xs text-foreground/60">
              {formatDate(phase.start_date)} – {formatDate(phase.end_date)}
            </p>
          </div>
          {phase.target_weekly_volume_km != null && (
            <p className="text-xs text-foreground/60">~{phase.target_weekly_volume_km} km/Woche</p>
          )}
        </div>
      ))}
    </div>
  );
}
