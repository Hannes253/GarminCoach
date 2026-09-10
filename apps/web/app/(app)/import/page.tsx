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
      <h1 className="text-lg font-semibold">Import</h1>

      <div className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <span className="text-sm font-medium">Automatischer Import über Strava</span>
        {params.strava_connected && (
          <p className="text-sm text-green-600">Strava erfolgreich verbunden.</p>
        )}
        {params.strava_error && (
          <p className="text-sm text-red-600">Strava-Verbindung fehlgeschlagen. Bitte erneut versuchen.</p>
        )}
        <StravaConnectStatus />
      </div>

      <ImportUploader />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground/70">Importierte Aktivitäten</h2>
        <ActivitiesList />
      </div>
    </div>
  );
}
