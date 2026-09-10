"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { runImport, type ImportRunSummary } from "@/lib/import/importOrchestrator";
import type { ImportProgressEvent } from "@/lib/import/types";

export function ImportUploader() {
  const router = useRouter();
  const [progress, setProgress] = useState<ImportProgressEvent | null>(null);
  const [summary, setSummary] = useState<ImportRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setSummary(null);
    setProgress(null);

    try {
      const sourceType = file.name.toLowerCase().endsWith(".zip") ? "fit_zip" : "csv";
      const result = await runImport(file, sourceType, setProgress);
      setSummary(result);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleFile(file);
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Garmin-Export hochladen</span>
        <input type="file" accept=".zip,.csv" disabled={busy} onChange={handleInputChange} className="text-sm" />
        <span className="text-xs text-foreground/50">
          ZIP-Bulk-Export (FIT-Dateien) oder Activities-CSV-Export aus Garmin Connect.
        </span>
      </label>

      {busy && progress && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full bg-foreground transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <span className="truncate text-xs text-foreground/60">
            {progress.phase === "parsing" ? "Lese" : "Lade hoch"}: {progress.processed}/{progress.total}
            {progress.currentFile ? ` – ${progress.currentFile}` : ""}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-600">Fehler: {error}</p>}

      {summary && (
        <div className="text-sm">
          <p className="font-medium">Fertig: {summary.total} Einträge verarbeitet.</p>
          <ul className="mt-1 text-foreground/70">
            <li>{summary.imported} neu importiert</li>
            <li>{summary.enrichedExisting} bestehende ergänzt</li>
            <li>{summary.duplicateSkipped} Duplikate übersprungen (bereits vorhanden)</li>
            {summary.error > 0 && <li className="text-red-600">{summary.error} Fehler</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
