import { DailyLogForm } from "@/components/DailyLogForm";
import { createClient } from "@/lib/supabase/server";

export async function DailyLogWidget() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("daily_log")
    .select("sleep_hours, sleep_quality, note")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .maybeSingle();

  return (
    <DailyLogForm
      logDate={today}
      initialSleepHours={existing?.sleep_hours ?? null}
      initialSleepQuality={existing?.sleep_quality ?? null}
      initialNote={existing?.note ?? null}
    />
  );
}
