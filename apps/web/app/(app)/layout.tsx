import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="flex-1 px-4 py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
