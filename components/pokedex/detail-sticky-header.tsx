"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DetailActions } from "@/components/pokedex/detail-actions";
import { cn } from "@/lib/utils";

export function DetailStickyHeader({ pokemonName }: { pokemonName: string }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "bg-background/95 supports-[backdrop-filter]:bg-background/80 relative sticky top-0 z-40 -mx-4 mb-4 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-1/2 w-screen -translate-x-1/2 border-b transition-opacity duration-200",
          isScrolled ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="flex items-center justify-between px-1 py-1">
        <Link href="/" className="text-sm font-medium underline-offset-4 hover:underline">
          Back to Pokedex
        </Link>
        <DetailActions pokemonName={pokemonName} />
      </div>
    </div>
  );
}
