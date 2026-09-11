import { ActivitiesList } from "@/components/ActivitiesList";
import { ImportUploader } from "@/components/ImportUploader";
import { StravaConnectStatus } from "@/components/StravaConnectStatus";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ strava_connected?: string; strava_error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Import</h1>
      </header>

      <section className="flex flex-col gap-2.5 rounded-2xl bg-card p-4">
        <span className="text-[15px] font-medium">Automatischer Import über Strava</span>
        {params.strava_connected && <p className="text-[13px] text-success">Strava erfolgreich verbunden.</p>}
        {params.strava_error && (
          <p className="text-[13px] text-danger">Strava-Verbindung fehlgeschlagen. Bitte erneut versuchen.</p>
        )}
        <StravaConnectStatus />
      </section>

      <ImportUploader />

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Importierte Aktivitäten</h2>
        <ActivitiesList />
      </section>
    </div>
  );
}
