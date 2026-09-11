"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveRaceDate(raceDate: string | null, raceName: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { error } = await supabase
    .from("user_settings")
    .update({ race_date: raceDate, race_name: raceName })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/plan");
  revalidatePath("/");
}
