import type { Warning } from "@garmincoach/training-engine";

export function WarningsList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-start gap-2.5 rounded-[var(--radius-card)] p-3.5 text-sm ${
            w.severity === "critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
          }`}
        >
          <span aria-hidden className="mt-0.5 text-base leading-none">
            {w.severity === "critical" ? "⚠️" : "ℹ️"}
          </span>
          <p className="flex-1 leading-snug">{w.message}</p>
        </div>
      ))}
    </div>
  );
}
