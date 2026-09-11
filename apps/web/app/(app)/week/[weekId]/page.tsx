export default async function WeekPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Woche {weekId}</h1>
      </header>
      <p className="rounded-2xl bg-card p-4 text-sm text-muted">
        Abhaken einzelner Einheiten und die Anpassungslogik kommen in Phase 4.
      </p>
    </div>
  );
}
