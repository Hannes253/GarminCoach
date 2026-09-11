"use client";

export default function OfflinePage() {
  return (
    <main className="safe-top safe-bottom flex min-h-full flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[22%] bg-fill text-2xl">📡</div>
      <h1 className="text-xl font-bold tracking-tight">Keine Verbindung</h1>
      <p className="max-w-xs text-[15px] text-muted">
        Du bist offline. Bereits besuchte Seiten zeigen weiter ihren letzten Stand - neue Daten gibt es erst
        wieder, sobald du online bist.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="tap-shrink mt-2 rounded-full bg-accent px-4 py-2 text-[15px] font-semibold text-accent-foreground"
      >
        Erneut versuchen
      </button>
    </main>
  );
}
