"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LAB_LINKS = [
  { href: "/lab/matchup-sim", label: "Matchup Sim" },
  { href: "/lab/teams", label: "Teams" },
];

export function LabNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2">
      {LAB_LINKS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

