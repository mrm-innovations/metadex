"use client";

import Image from "next/image";
import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Pokedex",
    isActive: (pathname) => pathname === "/" || pathname.startsWith("/pokemon/"),
  },
  {
    href: "/about",
    label: "About",
    isActive: (pathname) => pathname === "/about",
  },
  {
    href: "/api-reference",
    label: "API",
    isActive: (pathname) => pathname === "/api-reference",
  },
];

export function AppHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none">
          <Image
            src="/metadex_logo.png"
            alt="MetaDex"
            width={482}
            height={129}
            priority
            className="h-auto w-52 sm:w-60 md:w-64"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground hover:text-primary-foreground" : "hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <Button
            variant="outline"
            size="icon"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <div className="mx-auto w-full max-w-7xl border-t px-4 py-3 sm:px-6 lg:px-8 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary text-primary-foreground hover:text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
