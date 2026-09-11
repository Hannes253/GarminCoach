import { RaceDateForm } from "@/components/RaceDateForm";
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
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Einstellungen</h1>
      <RaceDateForm initialRaceDate={settings?.race_date ?? null} initialRaceName={settings?.race_name ?? null} />
    </div>
  );
}
