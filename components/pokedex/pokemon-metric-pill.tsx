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
}: {
  name: string;
  nat: string;
  spriteUrl?: string;
  metrics?: PokemonMetric[];
  className?: string;
}) {
  const iconUrl = getListSpriteUrl(nat, spriteUrl);

  return (
    <Pill className={cn("h-10 gap-2.5 px-3 pr-3 text-sm font-semibold", className)}>
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
      <span>{name}</span>
      {metrics.length > 0 ? (
        <span className="text-foreground/80 ml-1 inline-flex items-center gap-1 text-[10px] font-medium">
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
