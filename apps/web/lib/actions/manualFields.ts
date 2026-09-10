"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveActivityManualFields(
  activityId: string,
  rpe: number | null,
  note: string | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { error } = await supabase
    .from("activity_manual_fields")
    .upsert({ user_id: user.id, activity_id: activityId, rpe, note }, { onConflict: "activity_id" });
  if (error) throw new Error(error.message);

  revalidatePath("/import");
  revalidatePath("/history");
  revalidatePath("/");
}

export async function saveDailyLog(
  logDate: string,
  sleepHours: number | null,
  sleepQuality: number | null,
  note: string | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { error } = await supabase
    .from("daily_log")
    .upsert(
      { user_id: user.id, log_date: logDate, sleep_hours: sleepHours, sleep_quality: sleepQuality, note },
      { onConflict: "user_id,log_date" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/");
}
