"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DETAIL_LEAGUE_OPTIONS, DETAIL_LEAGUES, type DetailLeague } from "@/lib/detail-league";
import type { MetaTier } from "@/lib/gobattlelog";
import type { RankingsRow } from "@/lib/rankings";
import { cn } from "@/lib/utils";

type RankingsTab = "meta" | "pvp";

const PAGE_SIZE = 25;

const TIER_STYLES: Record<MetaTier, string> = {
  S: "border-emerald-400/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  A: "border-sky-400/60 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  B: "border-amber-400/60 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  C: "border-orange-400/60 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  D: "border-slate-400/60 bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }

  return spriteUrl;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildTypeOptions(rows: RankingsRow[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    values.add(row.type1);
    if (row.type2) {
      values.add(row.type2);
    }
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function RankingsBrowser({ rows }: { rows: RankingsRow[] }) {
  const [tab, setTab] = useState<RankingsTab>("meta");
  const [league, setLeague] = useState<DetailLeague>("great");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const typeOptions = useMemo(() => buildTypeOptions(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = rows.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q)) {
        return false;
      }

      if (typeFilter !== "all" && row.type1 !== typeFilter && row.type2 !== typeFilter) {
        return false;
      }

      if (tab === "meta") {
        return Boolean(row.meta[league]);
      }

      return true;
    });

    if (tab === "meta") {
      result.sort((a, b) => {
        const metaA = a.meta[league];
        const metaB = b.meta[league];
        if (metaA && metaB && metaA.rank !== metaB.rank) {
          return metaA.rank - metaB.rank;
        }
        return a.name.localeCompare(b.name);
      });
      return result;
    }

    result.sort((a, b) => {
      if (a.pvpProxy[league] !== b.pvpProxy[league]) {
        return b.pvpProxy[league] - a.pvpProxy[league];
      }
      const cpA = a.maxCp50 ?? -1;
      const cpB = b.maxCp50 ?? -1;
      if (cpA !== cpB) {
        return cpB - cpA;
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [league, rows, search, tab, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const onReset = () => {
    setSearch("");
    setTypeFilter("all");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={tab === "meta" ? "default" : "outline"}
              onClick={() => {
                setTab("meta");
                setPage(1);
              }}
            >
              Meta
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === "pvp" ? "default" : "outline"}
              onClick={() => {
                setTab("pvp");
                setPage(1);
              }}
            >
              PvP Proxy
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_220px_220px_auto]">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search Pokemon by name..."
              aria-label="Search rankings"
            />
            <Select
              value={league}
              onValueChange={(value) => {
                setLeague(value as DetailLeague);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="League selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DETAIL_LEAGUES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {DETAIL_LEAGUE_OPTIONS[item].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Type filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={onReset}>
              Reset
            </Button>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center justify-between text-sm">
            <span>
              Results: {filtered.length.toLocaleString()} / {rows.length.toLocaleString()}
            </span>
            <span>
              View: {tab === "meta" ? "Meta ranking" : "PvP league-fit proxy"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="min-w-[180px]">Type</TableHead>
                {tab === "meta" ? (
                  <>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Rating</TableHead>
                    <TableHead className="text-right">PvP Fit</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">PvP Fit</TableHead>
                    <TableHead className="text-right">ATK</TableHead>
                    <TableHead className="text-right">DEF</TableHead>
                    <TableHead className="text-right">HP</TableHead>
                    <TableHead className="text-right">Max CP50</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.length > 0 ? (
                pagedRows.map((row) => {
                  const iconUrl = getListSpriteUrl(row.nat, row.spriteUrl);
                  const meta = row.meta[league];
                  return (
                    <TableRow key={`${row.nat}-${row.name}`}>
                      <TableCell>
                        {iconUrl ? (
                          <Image
                            src={iconUrl}
                            alt={row.name}
                            width={28}
                            height={28}
                            unoptimized
                            className="size-7 object-contain"
                          />
                        ) : (
                          <span className="bg-muted inline-block size-7 rounded-full" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link
                          href={`/pokemon/${encodeURIComponent(row.nat)}?league=${league}`}
                          className="hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          <TypeBadge type={row.type1} />
                          {row.type2 ? <TypeBadge type={row.type2} /> : null}
                        </div>
                      </TableCell>
                      {tab === "meta" ? (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {meta ? meta.rank.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell>
                            {meta ? (
                              <Badge variant="outline" className={cn("text-xs", TIER_STYLES[meta.tier])}>
                                {meta.tier}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">Unranked</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {meta ? meta.rating.toFixed(1) : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.pvpProxy[league])}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.pvpProxy[league])}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{(row.pogoAtk ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{(row.pogoDef ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{(row.pogoHp ?? 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{(row.maxCp50 ?? 0).toLocaleString()}</TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={tab === "meta" ? 7 : 8} className="text-muted-foreground py-8 text-center">
                    No results match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Showing {(pagedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}-
          {(Math.min(currentPage * PAGE_SIZE, filtered.length)).toLocaleString()} of {filtered.length.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
          >
            Previous
          </Button>
          <span className="text-sm">Page {currentPage} / {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
