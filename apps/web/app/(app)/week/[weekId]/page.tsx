export default async function WeekPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Woche {weekId}</h1>
      <p className="text-sm text-foreground/60">
        Abhaken und Nachtragen von RPE/Schlaf/Notiz kommt in Phase 2 und Phase 4.
      </p>
    </div>
  );
}
