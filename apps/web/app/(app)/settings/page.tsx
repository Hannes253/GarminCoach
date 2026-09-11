import { RaceDateForm } from "@/components/RaceDateForm";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = user
    ? await supabase.from("user_settings").select("race_date, race_name").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-tight">Einstellungen</h1>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted">Renndatum</h2>
        <RaceDateForm initialRaceDate={settings?.race_date ?? null} initialRaceName={settings?.race_name ?? null} />
      </section>

      <section>
        <SignOutButton />
      </section>
    </div>
  );
}
