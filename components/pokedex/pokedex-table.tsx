import Image from "next/image";
import Link from "next/link";
import {
  ChevronRightIcon,
  HeartPulseIcon,
  ShieldIcon,
  SwordsIcon,
  type LucideIcon,
} from "lucide-react";

import { ClassificationBadge } from "@/components/pokedex/classification-badge";
import { TypeBadge } from "@/components/pokedex/type-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/pokedex";
import type { PokemonRow } from "@/lib/normalize";
import type { PokemonClassification } from "@/lib/pokeapi";
import { cn } from "@/lib/utils";

function getPokemonIconUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

function MobileStatPill({
  icon: Icon,
  label,
  value,
  emphasize = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null | undefined;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs",
        emphasize ? "border-primary/40 bg-primary/6" : undefined,
      )}
    >
      <Icon className="text-muted-foreground size-3.5" />
      <p className="text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

export function PokedexTable({
  rows,
  classificationByNat,
}: {
  rows: PokemonRow[];
  classificationByNat?: Record<string, PokemonClassification | null>;
}) {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">
                <span className="sr-only">Icon</span>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">ATK</TableHead>
              <TableHead className="text-right">DEF</TableHead>
              <TableHead className="text-right">HP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => {
              const iconUrl = getPokemonIconUrl(row.nat, row.spriteUrl);

              return (
                <TableRow key={`${row.nat}-${row.name}`}>
                  <TableCell>
                    {iconUrl ? (
                      <Image
                        src={iconUrl}
                        alt={row.name}
                        width={40}
                        height={40}
                        loading={rowIndex < 5 ? "eager" : "lazy"}
                        unoptimized
                        className="size-10 object-contain"
                      />
                    ) : (
                      <div className="bg-muted size-10 rounded-md" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                        href={`/pokemon/${encodeURIComponent(row.nat)}`}
                      >
                        {row.name}
                      </Link>
                      <ClassificationBadge classification={classificationByNat?.[row.nat] ?? null} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <TypeBadge type={row.type1} />
                      {row.type2 ? <TypeBadge type={row.type2} /> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(row.pogoAtk)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.pogoDef)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.pogoHp)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {rows.map((row, rowIndex) => {
          const iconUrl = getPokemonIconUrl(row.nat, row.spriteUrl);

          return (
            <Card key={`${row.nat}-${row.name}`}>
              <CardContent className="space-y-2.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/pokemon/${encodeURIComponent(row.nat)}`}
                    className="group -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
                  >
                    {iconUrl ? (
                      <Image
                        src={iconUrl}
                        alt={row.name}
                        width={48}
                        height={48}
                        loading={rowIndex < 5 ? "eager" : "lazy"}
                        unoptimized
                        className="size-12 object-contain"
                      />
                    ) : (
                      <div className="bg-muted size-12 rounded-md" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-[17px] font-semibold leading-5">{row.name}</p>
                        <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <ClassificationBadge classification={classificationByNat?.[row.nat] ?? null} />
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <TypeBadge type={row.type1} />
                    {row.type2 ? <TypeBadge type={row.type2} /> : null}
                  </div>
                </div>

                <div className="bg-border h-px" />

                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-1.5 pr-1">
                    <MobileStatPill icon={SwordsIcon} label="ATK" value={row.pogoAtk} />
                    <MobileStatPill icon={ShieldIcon} label="DEF" value={row.pogoDef} />
                    <MobileStatPill icon={HeartPulseIcon} label="HP" value={row.pogoHp} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
