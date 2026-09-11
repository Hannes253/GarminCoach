"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="tap-shrink w-full rounded-[var(--radius-card)] bg-card px-4 py-3.5 text-center text-[15px] font-medium text-danger"
    >
      Abmelden
    </button>
  );
}
