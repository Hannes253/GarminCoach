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

const PHASE_DOT_CLASS: Record<PhaseRow["phase_type"], string> = {
  base: "bg-accent/40",
  build: "bg-accent/65",
  specific: "bg-accent/90",
  taper: "bg-warning",
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
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-card">
      {phases.map((phase, i) => (
        <div
          key={phase.id}
          className={`flex items-center gap-3 px-4 py-3 ${i < phases.length - 1 ? "border-b border-separator" : ""}`}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PHASE_DOT_CLASS[phase.phase_type]}`} />
          <div className="flex-1">
            <p className="text-[15px] font-medium">{PHASE_LABELS[phase.phase_type]}</p>
            <p className="text-xs text-muted">
              {formatDate(phase.start_date)} – {formatDate(phase.end_date)}
            </p>
          </div>
          {phase.target_weekly_volume_km != null && (
            <p className="text-xs text-muted">~{phase.target_weekly_volume_km} km/Wo</p>
          )}
        </div>
      ))}
    </div>
  );
}
