import { SignOutButton } from "@/components/SignOutButton";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Heute</h1>
        <SignOutButton />
      </header>
      <p className="text-sm text-foreground/60">
        Diese Seite zeigt später die heutige Einheit, den Formstand und offene Warnungen.
        Kommt in Phase 2 (Analyse) und Phase 4 (Anpassungslogik).
      </p>
    </div>
  );
}
