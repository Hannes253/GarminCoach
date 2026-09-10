import Papa from "papaparse";
import { normalizeCsvRow, type GarminCsvRow } from "./normalize";
import type { NormalizedActivityInput } from "./types";

/**
 * Parses a Garmin Connect "Activities" CSV export in the browser and yields
 * normalized activities. Shares the `() => AsyncGenerator<NormalizedActivityInput>`
 * shape with the FIT-ZIP import path (see zip.ts) - that shared shape is the
 * "ImportSource" extensibility seam a future automatic-sync source would
 * also implement, without needing a separate formal interface today.
 */
export async function* parseCsvFile(file: File): AsyncGenerator<NormalizedActivityInput> {
  const rows = await new Promise<GarminCsvRow[]>((resolve, reject) => {
    Papa.parse<GarminCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: Error) => reject(error),
    });
  });

  for (const row of rows) {
    const normalized = normalizeCsvRow(row);
    if (normalized) yield normalized;
  }
}
