"use client";

import { createClient } from "@/lib/supabase/client";
import { activityInputToInsert, rowToActivityInput, type ExistingActivityRow } from "@/lib/mappers/activity";
import { parseCsvFile } from "./csvParser";
import { computeDedupKey, sha256Hex } from "./dedupKey";
import { runFitZipImport } from "./fitZipImport";
import { mergeActivity, type ActivitySource } from "./mergeActivity";
import type { ImportItemResult, ImportItemStatus, ImportProgressEvent, NormalizedActivityInput } from "./types";

interface QueuedActivity {
  itemName: string;
  fileHash: string | null;
  source: ActivitySource;
  activity: NormalizedActivityInput;
}

const UPLOAD_CHUNK_SIZE = 25;

export interface ImportRunSummary {
  total: number;
  imported: number;
  duplicateSkipped: number;
  enrichedExisting: number;
  error: number;
  items: ImportItemResult[];
}

function emptySummary(): ImportRunSummary {
  return { total: 0, imported: 0, duplicateSkipped: 0, enrichedExisting: 0, error: 0, items: [] };
}

function tallyKeyFor(status: ImportItemStatus): keyof ImportRunSummary {
  switch (status) {
    case "imported":
      return "imported";
    case "duplicate_skipped":
      return "duplicateSkipped";
    case "enriched_existing":
      return "enrichedExisting";
    case "error":
      return "error";
  }
}

/**
 * Runs one file's full import: create/resolve the import_batches row, parse
 * the file (FIT ZIP in a Web Worker, or CSV inline) into normalized
 * activities, then upload in chunks - each chunk fetches any existing rows
 * for its dedup_keys, merges by source priority (mergeActivity), and upserts
 * the result. Only normalized data ever leaves the browser.
 */
export async function runImport(
  file: File,
  sourceType: "fit_zip" | "csv",
  onProgress: (event: ImportProgressEvent) => void,
): Promise<ImportRunSummary> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = await sha256Hex(fileBytes);

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .upsert(
      { user_id: user.id, source_type: sourceType, file_name: file.name, file_hash: fileHash, status: "processing" },
      { onConflict: "user_id,file_hash" },
    )
    .select()
    .single();
  if (batchError || !batch) {
    throw new Error(batchError?.message ?? "Import-Batch konnte nicht angelegt werden.");
  }

  // Phase 1: parse everything into memory first, reporting parse progress.
  // Files/rows that fail to parse are recorded as errors immediately - they
  // never enter the upload queue since there is nothing to upsert for them.
  const queued: QueuedActivity[] = [];
  const parseErrors: ImportItemResult[] = [];

  if (sourceType === "fit_zip") {
    await runFitZipImport(file, {
      onProgress: (e) =>
        onProgress({ phase: "parsing", processed: e.processed, total: e.total, currentFile: e.currentFile }),
      onActivity: (fileName, fitFileHash, activity) => {
        queued.push({ itemName: fileName, fileHash: fitFileHash, source: "fit", activity });
      },
      onError: (fileName, error) => {
        parseErrors.push({ itemName: fileName, fileHash: null, dedupKey: null, status: "error", error });
      },
    });
  } else {
    const rows: NormalizedActivityInput[] = [];
    for await (const activity of parseCsvFile(file)) rows.push(activity);
    rows.forEach((activity, i) => {
      const itemName = `CSV-Zeile ${i + 1} (${activity.startTime.slice(0, 10)})`;
      queued.push({ itemName, fileHash: null, source: "csv", activity });
      onProgress({ phase: "parsing", processed: i + 1, total: rows.length, currentFile: itemName });
    });
  }

  // Phase 2: upload in chunks.
  const summary = emptySummary();
  summary.items.push(...parseErrors);
  summary.error += parseErrors.length;
  summary.total += parseErrors.length;

  if (parseErrors.length > 0) {
    await supabase.from("import_batch_items").insert(
      parseErrors.map((e) => ({
        user_id: user.id,
        import_batch_id: batch.id,
        item_name: e.itemName,
        file_hash: e.fileHash,
        dedup_key: e.dedupKey,
        status: "error" as const,
        error: e.error ?? null,
      })),
    );
  }

  let uploaded = 0;
  for (let i = 0; i < queued.length; i += UPLOAD_CHUNK_SIZE) {
    const chunk = queued.slice(i, i + UPLOAD_CHUNK_SIZE);
    const dedupKeys = chunk.map((q) => computeDedupKey(q.activity));

    const { data: existingRows } = await supabase
      .from("activities")
      .select(
        "dedup_key, source, sport, sub_sport, start_time, duration_seconds, distance_meters, avg_pace_sec_per_km, avg_hr, max_hr, hr_zone_seconds, elevation_gain_meters, avg_cadence, calories",
      )
      .eq("user_id", user.id)
      .in("dedup_key", dedupKeys);

    const existingByKey = new Map(
      ((existingRows ?? []) as ExistingActivityRow[]).map((row) => [row.dedup_key, rowToActivityInput(row)]),
    );

    const chunkResults = chunk.map((item, idx) => {
      const dedupKey = dedupKeys[idx]!;
      const existing = existingByKey.get(dedupKey) ?? null;
      const { merged, source, status } = mergeActivity(existing, item.activity, item.source);

      return {
        item,
        dedupKey,
        status,
        insertRow: activityInputToInsert({
          activity: merged,
          source,
          dedupKey,
          userId: user.id,
          importBatchId: batch.id,
          fileHash: item.fileHash,
        }),
      };
    });

    for (const r of chunkResults) {
      summary.items.push({ itemName: r.item.itemName, fileHash: r.item.fileHash, dedupKey: r.dedupKey, status: r.status });
      summary[tallyKeyFor(r.status)]++;
      summary.total++;
    }

    if (chunkResults.length > 0) {
      const { data: upserted, error: upsertError } = await supabase
        .from("activities")
        .upsert(
          chunkResults.map((r) => r.insertRow),
          { onConflict: "user_id,dedup_key" },
        )
        .select("id, dedup_key");
      if (upsertError) throw new Error(upsertError.message);

      const activityIdByDedupKey = new Map((upserted ?? []).map((row) => [row.dedup_key, row.id]));
      const batchItemRows = chunkResults.map((r) => ({
        user_id: user.id,
        import_batch_id: batch.id,
        item_name: r.item.itemName,
        file_hash: r.item.fileHash,
        dedup_key: r.dedupKey,
        status: r.status,
        activity_id: activityIdByDedupKey.get(r.dedupKey) ?? null,
      }));
      const { error: itemsError } = await supabase.from("import_batch_items").insert(batchItemRows);
      if (itemsError) throw new Error(itemsError.message);
    }

    uploaded += chunk.length;
    onProgress({
      phase: "uploading",
      processed: uploaded,
      total: queued.length,
      currentFile: chunk.at(-1)?.itemName ?? "",
    });
  }

  await supabase
    .from("import_batches")
    .update({
      status: "completed",
      activity_count: summary.imported + summary.enrichedExisting,
      imported_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  return summary;
}
