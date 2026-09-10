import { unzipSync } from "fflate";
import { Decoder, Stream } from "@garmin/fitsdk";
import { normalizeFitSession, type FitSessionMesg } from "./normalize";
import { sha256Hex } from "./dedupKey";
import type { NormalizedActivityInput } from "./types";

/**
 * Runs entirely inside a Web Worker: unzips the Garmin bulk-export ZIP
 * (fflate) and decodes each .fit file (Garmin FIT JS SDK) off the main
 * thread, so the UI stays responsive and there's a real per-file progress
 * signal for the import page's progress bar. Nothing here ever leaves the
 * browser - only the normalized results get posted back, which is what the
 * main thread then sends to Supabase.
 */

export interface FitWorkerRequest {
  type: "parseZip";
  buffer: ArrayBuffer;
}

export type FitWorkerMessage =
  | { type: "progress"; processed: number; total: number; currentFile: string }
  | { type: "activity"; fileName: string; fileHash: string; activity: NormalizedActivityInput }
  | { type: "error"; fileName: string; error: string }
  | { type: "done" };

// The "webworker" lib conflicts with the app's "dom" lib, so `self` is typed
// narrowly here via the `Worker` class shape (its postMessage/onmessage
// signatures match DedicatedWorkerGlobalScope closely enough) rather than
// pulling in a separate tsconfig just for this file.
const ctx = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<FitWorkerRequest>) => {
  if (event.data.type !== "parseZip") return;

  const zip = unzipSync(new Uint8Array(event.data.buffer), {
    filter: (file) => file.name.toLowerCase().endsWith(".fit"),
  });

  const entries = Object.entries(zip);
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const [fileName, bytes] = entry;

    try {
      const fileHash = await sha256Hex(bytes);
      const decoder = new Decoder(Stream.fromBuffer(bytes));
      const { messages, errors } = decoder.read();

      // The SDK's own .d.ts types enum fields like `sport` as their raw
      // numeric FIT value regardless of decoder options, but the default
      // (and only) options this app uses set convertTypesToStrings: true,
      // so the runtime value is actually a string ("running", ...) - hence
      // the cast through `unknown` rather than relying on the SDK's types.
      const session = messages.sessionMesgs?.[0] as unknown as FitSessionMesg | undefined;
      const activity = session ? normalizeFitSession(session) : null;

      if (activity) {
        ctx.postMessage({ type: "activity", fileName, fileHash, activity } satisfies FitWorkerMessage);
      } else {
        const reason = errors[0]?.message ?? "No usable session data in FIT file";
        ctx.postMessage({ type: "error", fileName, error: reason } satisfies FitWorkerMessage);
      }
    } catch (err) {
      ctx.postMessage({
        type: "error",
        fileName,
        error: err instanceof Error ? err.message : String(err),
      } satisfies FitWorkerMessage);
    }

    ctx.postMessage({
      type: "progress",
      processed: i + 1,
      total,
      currentFile: fileName,
    } satisfies FitWorkerMessage);
  }

  ctx.postMessage({ type: "done" } satisfies FitWorkerMessage);
};
