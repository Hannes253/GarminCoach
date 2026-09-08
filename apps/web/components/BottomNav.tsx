"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Heute" },
  { href: "/history", label: "Verlauf" },
  { href: "/import", label: "Import" },
  { href: "/plan", label: "Plan" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex border-t border-black/10 bg-background dark:border-white/10">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-sm ${
              active ? "font-semibold" : "text-foreground/60"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
