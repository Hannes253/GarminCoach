import type { Warning } from "@garmincoach/training-engine";

export function WarningsList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {warnings.map((w, i) => (
        <p
          key={i}
          className={`rounded-md border p-2 text-xs ${
            w.severity === "critical"
              ? "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400"
              : "border-orange-600/30 bg-orange-600/10 text-orange-700 dark:text-orange-400"
          }`}
        >
          {w.message}
        </p>
      ))}
    </div>
  );
}
