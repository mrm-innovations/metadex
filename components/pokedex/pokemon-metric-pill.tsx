"use client";

import Image from "next/image";

import { Pill } from "@/components/pokedex/pill";
import { cn } from "@/lib/utils";

type PokemonMetric = {
  label: string;
  value: string;
};

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

export function PokemonMetricPill({
  name,
  nat,
  spriteUrl,
  metrics = [],
  className,
  mobileStacked = false,
}: {
  name: string;
  nat: string;
  spriteUrl?: string;
  metrics?: PokemonMetric[];
  className?: string;
  mobileStacked?: boolean;
}) {
  const iconUrl = getListSpriteUrl(nat, spriteUrl);

  return (
    <Pill
      className={cn(
        mobileStacked
          ? "min-h-10 h-auto w-full flex-col items-start gap-1.5 px-3 py-2 text-sm font-semibold sm:h-10 sm:w-auto sm:flex-row sm:items-center sm:gap-2.5 sm:py-0 sm:pr-3"
          : "h-10 gap-2.5 px-3 pr-3 text-sm font-semibold",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={name}
            width={24}
            height={24}
            unoptimized
            className="size-6 object-contain"
          />
        ) : (
          <span className="bg-muted size-6 rounded-full" />
        )}
        <span className={cn("truncate", mobileStacked ? "max-w-full" : undefined)}>{name}</span>
      </span>
      {metrics.length > 0 ? (
        <span
          className={cn(
            "text-foreground/80 inline-flex items-center gap-1 text-[10px] font-medium",
            mobileStacked ? "ml-0 flex-wrap" : "ml-1",
          )}
        >
          {metrics.map((metric) => (
            <span
              key={`${metric.label}-${metric.value}`}
              className="bg-background/80 rounded border border-border/60 px-1.5 py-0.5"
            >
              {metric.label} {metric.value}
            </span>
          ))}
        </span>
      ) : null}
    </Pill>
  );
}
