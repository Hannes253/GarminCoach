import type { ReactNode } from "react";

export type StatCardTone = "neutral" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatCardTone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

/**
 * A single glanceable metric. Value uses proportional (non-tabular) figures -
 * this is a standalone display number, not a column that needs to align with
 * others (see dataviz skill: tabular-nums is for table/axis columns only).
 */
export function StatCard({
  label,
  value,
  unit,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  tone?: StatCardTone;
}) {
  return (
    <div className="card-hover flex flex-col gap-1 rounded-[var(--radius-card)] bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-[28px] font-bold leading-tight tracking-tight ${TONE_CLASS[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function StatCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
