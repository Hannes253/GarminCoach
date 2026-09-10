import { ActivitiesList } from "@/components/ActivitiesList";
import { ImportUploader } from "@/components/ImportUploader";

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Import</h1>
      <ImportUploader />
      <div>
        <h2 className="mb-2 text-sm font-semibold text-foreground/70">Importierte Aktivitäten</h2>
        <ActivitiesList />
      </div>
    </div>
  );
}
