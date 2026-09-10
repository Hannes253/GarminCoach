"use client";

import type { FitWorkerMessage, FitWorkerRequest } from "./fitWorker";
import type { NormalizedActivityInput } from "./types";

export interface FitZipParseProgress {
  processed: number;
  total: number;
  currentFile: string;
}

export interface FitZipImportCallbacks {
  onProgress: (event: FitZipParseProgress) => void;
  onActivity: (fileName: string, fileHash: string, activity: NormalizedActivityInput) => void;
  onError: (fileName: string, error: string) => void;
}

/**
 * Spawns the FIT-decoding worker for one ZIP file and resolves once every
 * entry has been processed. Only NormalizedActivityInput objects (plus a
 * per-file SHA-256) ever cross back to the main thread - the raw FIT bytes
 * stay inside the worker and are discarded when it terminates.
 *
 * Loaded from a pre-bundled static asset (public/workers/fit-worker.js,
 * built by scripts/build-worker.mjs) rather than
 * `new Worker(new URL('./fitWorker.ts', import.meta.url))`: Turbopack does
 * not currently compile that pattern into a runnable worker chunk for this
 * dependency graph, it just copies the raw .ts source, which the browser
 * can't execute.
 */
export function runFitZipImport(file: File, callbacks: FitZipImportCallbacks): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/workers/fit-worker.js", { type: "module" });

    worker.onmessage = (event: MessageEvent<FitWorkerMessage>) => {
      const msg = event.data;
      switch (msg.type) {
        case "progress":
          callbacks.onProgress(msg);
          break;
        case "activity":
          callbacks.onActivity(msg.fileName, msg.fileHash, msg.activity);
          break;
        case "error":
          callbacks.onError(msg.fileName, msg.error);
          break;
        case "done":
          worker.terminate();
          resolve();
          break;
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "FIT worker failed"));
    };

    file
      .arrayBuffer()
      .then((buffer) => {
        worker.postMessage({ type: "parseZip", buffer } satisfies FitWorkerRequest, [buffer]);
      })
      .catch(reject);
  });
}
