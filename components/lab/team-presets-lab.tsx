"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, CopyIcon, RotateCcwIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DETAIL_LEAGUES, DETAIL_LEAGUE_OPTIONS, parseDetailLeague, type DetailLeague } from "@/lib/detail-league";
import { type PokemonRow } from "@/lib/normalize";
import { parseNatSortValue } from "@/lib/pokedex";
import { analyzeTeam, createLeagueFitContext, getLeagueFitScore } from "@/lib/team-lab";
import { formatTypeName, getDefensiveMatchups, type GoPokemonType } from "@/lib/type-effectiveness";
import { cn } from "@/lib/utils";

const LOCAL_STORAGE_KEY = "metadex_team_presets_v1";
const DEFAULT_SLOT_COUNT = 3;
const DEFAULT_REPLACEMENT_VISIBLE = 3;
const REPLACEMENT_PAGE_SIZE = 9;

type CoreSlotIndex = 0 | 1 | 2 | null;

type SavedPreset = {
  id: string;
  name: string;
  league: DetailLeague;
  slots: [string, string, string];
  coreSlot: CoreSlotIndex;
  updatedAt: string;
};

function getListSpriteUrl(nat: string, spriteUrl?: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }
  return spriteUrl;
}

function formatNatLabel(nat: string): string {
  const parsed = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
    return `#${String(parsed).padStart(3, "0")}`;
  }
  return `#${nat}`;
}

function getDefaultSlots(rows: PokemonRow[]): [string, string, string] {
  const first = rows[0]?.nat ?? "";
  const second = rows[1]?.nat ?? first;
  const third = rows[2]?.nat ?? second;
  return [first, second, third];
}

function sanitizeSlots(slots: string[], rows: PokemonRow[]): [string, string, string] {
  const available = new Set(rows.map((row) => row.nat));
  const used = new Set<string>();
  const normalized: [string, string, string] = ["", "", ""];

  for (let i = 0; i < DEFAULT_SLOT_COUNT; i += 1) {
    const slot = (slots[i] ?? "").trim();
    if (!slot || !available.has(slot) || used.has(slot)) {
      normalized[i] = "";
      continue;
    }
    normalized[i] = slot;
    used.add(slot);
  }

  return normalized;
}

function parseCoreSlotValue(value: unknown): CoreSlotIndex {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "none" || normalized === "") {
    return null;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (parsed === 0 || parsed === 1 || parsed === 2) {
    return parsed;
  }
  return null;
}

function parseSavedPresets(raw: string | null): SavedPreset[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SavedPreset[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        league: parseDetailLeague(item.league),
        slots: [item.slots[0], item.slots[1], item.slots[2]],
        coreSlot: parseCoreSlotValue((item as { coreSlot?: unknown }).coreSlot),
        updatedAt: String(item.updatedAt),
      }));
  } catch {
    return [];
  }
}

function compareRows(a: PokemonRow, b: PokemonRow): number {
  const diff = parseNatSortValue(a.nat) - parseNatSortValue(b.nat);
  if (diff !== 0) {
    return diff;
  }
  return a.name.localeCompare(b.name);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatPercentOneDecimal(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getScoreTier(score: number): {
  label: string;
  grade: "A" | "B" | "C" | "D";
  className: string;
  progressClassName: string;
} {
  const pct = score * 100;
  if (pct >= 75) {
    return {
      label: "Battle-ready",
      grade: "A",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      progressClassName: "bg-emerald-500",
    };
  }
  if (pct >= 55) {
    return {
      label: "Solid",
      grade: "B",
      className: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      progressClassName: "bg-sky-500",
    };
  }
  if (pct >= 35) {
    return {
      label: "Needs tuning",
      grade: "C",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      progressClassName: "bg-amber-500",
    };
  }
  return {
    label: "High risk",
    grade: "D",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    progressClassName: "bg-rose-500",
  };
}

function PokemonSlotCombobox({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: PokemonRow[];
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((row) => row.nat === value) ?? null;
  const selectedIcon = selected ? getListSpriteUrl(selected.nat, selected.spriteUrl) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selectedIcon ? (
              <Image
                src={selectedIcon}
                alt={selected?.name ?? "Pokemon"}
                width={24}
                height={24}
                unoptimized
                className="size-6 object-contain"
              />
            ) : (
              <span className="bg-muted size-6 rounded-full" />
            )}
            <span className="truncate">
              {selected ? `${selected.name} (${formatNatLabel(selected.nat)})` : label}
            </span>
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search Pokemon by name or nat..." />
          <CommandList>
            <CommandEmpty>No matching Pokemon.</CommandEmpty>
            <CommandGroup>
              {options.map((row) => {
                const icon = getListSpriteUrl(row.nat, row.spriteUrl);
                return (
                  <CommandItem
                    key={`slot-option-${row.nat}-${row.name}`}
                    value={`${row.name} ${row.nat} ${formatNatLabel(row.nat)}`}
                    onSelect={() => {
                      onValueChange(row.nat);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon className={cn("size-4", row.nat === value ? "opacity-100" : "opacity-0")} />
                    {icon ? (
                      <Image
                        src={icon}
                        alt={row.name}
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6 object-contain"
                      />
                    ) : (
                      <span className="bg-muted size-6 rounded-full" />
                    )}
                    <span className="truncate">{row.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">{formatNatLabel(row.nat)}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TeamPresetsLab({
  rows,
  initialLeague,
  initialSlots,
  initialCoreSlot,
}: {
  rows: PokemonRow[];
  initialLeague: DetailLeague;
  initialSlots: string[];
  initialCoreSlot: CoreSlotIndex;
}) {
  const sortedRows = useMemo(() => [...rows].sort(compareRows), [rows]);
  const rowByNat = useMemo(() => {
    const map = new Map<string, PokemonRow>();
    for (const row of sortedRows) {
      map.set(row.nat, row);
    }
    return map;
  }, [sortedRows]);

  const [league, setLeague] = useState<DetailLeague>(initialLeague);
  const [slots, setSlots] = useState<[string, string, string]>(() =>
    initialSlots.length > 0
      ? sanitizeSlots(initialSlots, sortedRows)
      : getDefaultSlots(sortedRows),
  );
  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }
    return parseSavedPresets(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [activeThreatFilter, setActiveThreatFilter] = useState<GoPokemonType | "all">("all");
  const [visibleSuggestionCount, setVisibleSuggestionCount] = useState(
    DEFAULT_REPLACEMENT_VISIBLE,
  );
  const [coreSlot, setCoreSlot] = useState<CoreSlotIndex>(initialCoreSlot);

  const selectedRowsBySlot = useMemo(
    () =>
      slots.map((nat) => rowByNat.get(nat) ?? null) as [
        PokemonRow | null,
        PokemonRow | null,
        PokemonRow | null,
      ],
    [rowByNat, slots],
  );
  const selectedRows = useMemo(
    () => selectedRowsBySlot.filter((row): row is PokemonRow => row !== null),
    [selectedRowsBySlot],
  );
  const analysis = useMemo(() => analyzeTeam(selectedRows, sortedRows, league), [selectedRows, sortedRows, league]);
  const leagueFitContext = useMemo(() => createLeagueFitContext(sortedRows), [sortedRows]);
  const availableThreatTypes = useMemo(
    () => new Set(analysis.topThreats.map((threat) => threat.type)),
    [analysis.topThreats],
  );
  const effectiveThreatFilter: GoPokemonType | "all" =
    activeThreatFilter === "all" || availableThreatTypes.has(activeThreatFilter)
      ? activeThreatFilter
      : "all";

  const filteredTopThreats = useMemo(() => {
    if (effectiveThreatFilter === "all") {
      return analysis.topThreats;
    }
    return analysis.topThreats.filter((threat) => threat.type === effectiveThreatFilter);
  }, [analysis.topThreats, effectiveThreatFilter]);

  const replacementSuggestions = useMemo(() => {
    if (selectedRows.length !== 3 || analysis.uncoveredTypes.length === 0) {
      return null;
    }

    const uncovered = new Set(analysis.uncoveredTypes);
    const coreRow = coreSlot !== null ? selectedRowsBySlot[coreSlot] : null;
    const coreWeaknesses = coreRow
      ? getDefensiveMatchups(coreRow.type1, coreRow.type2).weaknesses.map((entry) => entry.attackType)
      : [];
    const coreWeaknessSet = new Set(coreWeaknesses);
    const targetSet = coreRow && coreWeaknessSet.size > 0 ? coreWeaknessSet : uncovered;
    const memberByNat = new Map(analysis.members.map((member) => [member.nat, member]));

    const weakest = selectedRowsBySlot
      .map((row, index) => {
        if (!row) {
          return null;
        }
        if (coreSlot !== null && index === coreSlot) {
          return null;
        }
        const member = memberByNat.get(row.nat);
        const matchups = getDefensiveMatchups(row.type1, row.type2);
        const resistsTarget = matchups.resistances.filter((entry) =>
          targetSet.has(entry.attackType),
        );
        const resistsUncovered = matchups.resistances.filter((entry) =>
          uncovered.has(entry.attackType),
        );
        return {
          index,
          row,
          targetCoverage: resistsTarget.length,
          resistCoverage: resistsUncovered.length,
          leagueFit: member?.leagueFit ?? 0,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          index: number;
          row: PokemonRow;
          targetCoverage: number;
          resistCoverage: number;
          leagueFit: number;
        } => entry !== null,
      )
      .sort(
        (a, b) =>
          a.targetCoverage - b.targetCoverage ||
          a.resistCoverage - b.resistCoverage ||
          a.leagueFit - b.leagueFit ||
          a.row.name.localeCompare(b.row.name),
      )[0];

    if (!weakest) {
      return null;
    }

    const selectedNats = new Set(selectedRows.map((row) => row.nat));
    const candidates: Array<{
      row: PokemonRow;
      score: number;
      resistCoverage: number;
      targetCoverage: number;
      leagueFit: number;
    }> = [];

    for (const candidate of sortedRows) {
      if (selectedNats.has(candidate.nat)) {
        continue;
      }
      const matchups = getDefensiveMatchups(candidate.type1, candidate.type2);
      const targetCoverageWeight = matchups.resistances.reduce((acc, entry) => {
        if (!targetSet.has(entry.attackType)) {
          return acc;
        }
        return acc + (entry.multiplier <= 0.390625 ? 1.4 : 1);
      }, 0);
      const uncoveredCoverageWeight = matchups.resistances.reduce((acc, entry) => {
        if (!uncovered.has(entry.attackType)) {
          return acc;
        }
        return acc + (entry.multiplier <= 0.390625 ? 1.4 : 1);
      }, 0);
      if (targetCoverageWeight <= 0) {
        continue;
      }
      const leagueFit = getLeagueFitScore(candidate, league, leagueFitContext);
      const coverageScore = coreRow
        ? targetCoverageWeight * 1.6 + uncoveredCoverageWeight * 0.5
        : uncoveredCoverageWeight;
      const score = coverageScore * 0.85 + leagueFit * 0.15;
      const targetCoverage = matchups.resistances.filter((entry) => targetSet.has(entry.attackType)).length;
      candidates.push({
        row: candidate,
        score,
        resistCoverage: Math.round(uncoveredCoverageWeight),
        targetCoverage,
        leagueFit,
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort(
      (a, b) =>
        b.score - a.score ||
        b.resistCoverage - a.resistCoverage ||
        b.leagueFit - a.leagueFit ||
        a.row.name.localeCompare(b.row.name),
    );

    return {
      replace: weakest.row,
      replaceIndex: weakest.index,
      focus: coreRow ? "core" : "team",
      coreName: coreRow?.name ?? null,
      targetTypeCount: targetSet.size,
      candidates,
    };
  }, [analysis.members, analysis.uncoveredTypes, coreSlot, league, leagueFitContext, selectedRows, selectedRowsBySlot, sortedRows]);
  const visibleSuggestions = useMemo(() => {
    if (!replacementSuggestions) {
      return [];
    }
    return replacementSuggestions.candidates.slice(0, visibleSuggestionCount);
  }, [replacementSuggestions, visibleSuggestionCount]);
  const hiddenSuggestionsCount = useMemo(() => {
    if (!replacementSuggestions) {
      return 0;
    }
    return Math.max(
      0,
      replacementSuggestions.candidates.length - visibleSuggestionCount,
    );
  }, [replacementSuggestions, visibleSuggestionCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams();
    params.set("league", league);
    params.set("slots", slots.join(","));
    params.set("core", coreSlot === null ? "none" : String(coreSlot));
    const nextUrl = `/lab/teams?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [coreSlot, league, slots]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedPresets));
  }, [savedPresets]);

  const onSetSlot = (index: number, nextNat: string) => {
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setSlots((current) => {
      const next = [...current] as [string, string, string];
      const target = nextNat.trim();
      for (let i = 0; i < next.length; i += 1) {
        if (i !== index && next[i] === target) {
          next[i] = "";
        }
      }
      next[index] = target;
      return sanitizeSlots(next, sortedRows);
    });
  };

  const onClearSlot = (index: 0 | 1 | 2) => {
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setSlots((current) => {
      const next = [...current] as [string, string, string];
      next[index] = "";
      return sanitizeSlots(next, sortedRows);
    });
    setCoreSlot((current) => (current === index ? null : current));
  };

  const onClearAllSlots = () => {
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setSlots(["", "", ""]);
    setCoreSlot(null);
    setActiveThreatFilter("all");
    setCopyStatus(null);
  };

  const onSetLeague = (value: string) => {
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setLeague(parseDetailLeague(value));
  };

  const onToggleCoreSlot = (index: 0 | 1 | 2) => {
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setCoreSlot((current) => (current === index ? null : index));
  };

  const onReset = () => {
    setLeague(initialLeague);
    setSlots(
      initialSlots.length > 0
        ? sanitizeSlots(initialSlots, sortedRows)
        : getDefaultSlots(sortedRows),
    );
    setCoreSlot(initialCoreSlot);
    setActiveThreatFilter("all");
    setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
    setCopyStatus(null);
  };

  const onApplySuggestion = (candidateNat: string) => {
    if (!replacementSuggestions) {
      return;
    }
    onSetSlot(replacementSuggestions.replaceIndex, candidateNat);
  };

  const onCopyShareLink = async () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopyStatus("Share link copied.");
    } catch {
      setCopyStatus("Could not copy link. Copy from browser URL.");
    }
  };

  const onSavePreset = () => {
    const trimmed = presetName.trim();
    const name = trimmed || `Team ${new Date().toLocaleDateString()}`;
    const nextPreset: SavedPreset = {
      id: `${Date.now()}`,
      name,
      league,
      slots,
      coreSlot,
      updatedAt: new Date().toISOString(),
    };
    setSavedPresets((current) => [nextPreset, ...current].slice(0, 20));
    setPresetName("");
  };

  const slotLabels = ["Slot 1", "Slot 2", "Slot 3"];
  const scoreTier = getScoreTier(analysis.score);
  const scorePct = clampPercent(analysis.score * 100);
  const primaryThreat = analysis.topThreats[0];

  return (
    <div className="space-y-4" data-testid="team-presets-lab">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Shareable Team Presets</CardTitle>
          <p className="text-muted-foreground text-sm">
            Build a 3-slot team, share via URL, and save local presets without an account.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="max-w-sm">
              <Select value={league} onValueChange={onSetLeague}>
                <SelectTrigger
                  aria-label="Team league selector"
                  className="min-w-0 [&>span]:truncate"
                >
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
            </div>

            <div className="space-y-2">
              {slots.map((slot, index) => {
                const slotIndex = index as 0 | 1 | 2;
                return (
                <div
                  key={`slot-wrap-${index}`}
                  className="grid items-center gap-2 md:grid-cols-[72px_minmax(0,1fr)_auto_auto]"
                >
                  <p className="text-muted-foreground text-sm font-medium">
                    {slotLabels[index]}
                  </p>
                  <div className="min-w-0">
                <PokemonSlotCombobox
                  label={`${slotLabels[index]} selector`}
                  value={slot}
                  options={sortedRows.filter((row) => row.nat === slot || !slots.includes(row.nat))}
                  onValueChange={(value) => onSetSlot(index, value)}
                />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={coreSlot === slotIndex ? "secondary" : "outline"}
                    className="h-9 rounded-full px-3 text-xs"
                    onClick={() => onToggleCoreSlot(slotIndex)}
                    disabled={!slot}
                  >
                    {coreSlot === slotIndex ? "Core selected" : "Set as core"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground h-9 w-9 rounded-full"
                    onClick={() => onClearSlot(slotIndex)}
                    aria-label={`Clear ${slotLabels[index]}`}
                    disabled={!slot}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCopyShareLink}>
              <CopyIcon className="size-4" />
              Copy share link
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onReset}>
              <RotateCcwIcon className="size-4" />
              Reset
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClearAllSlots}>
              <XIcon className="size-4" />
              Clear all
            </Button>
          </div>
          {copyStatus ? <p className="text-muted-foreground text-xs">{copyStatus}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Overall team readiness</p>
              <Badge variant="outline" className={cn("h-fit rounded-full px-3 py-1 text-xs", scoreTier.className)}>
                Grade {scoreTier.grade}: {scoreTier.label}
              </Badge>
            </div>
            <div className="space-y-1.5">
              <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full border">
                <div
                  className={cn("h-full rounded-full transition-all", scoreTier.progressClassName)}
                  style={{ width: `${scorePct}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {scorePct}% score from coverage, league fit, and type diversity.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedRowsBySlot.map((row, index) => {
              if (!row) {
                return null;
              }
              const sprite = getListSpriteUrl(row.nat, row.spriteUrl);
              const leagueFit = analysis.perMemberLeagueFit.find((item) => item.nat === row.nat)?.leagueFit ?? 0;
              return (
                <Link key={`${row.nat}-${row.name}`} href={`/pokemon/${encodeURIComponent(row.nat)}`} className="group">
                  <Badge
                    variant="outline"
                    className="h-10 gap-2 rounded-full px-3 text-sm transition-colors hover:border-sky-500/50 hover:bg-sky-500/10"
                  >
                    {sprite ? (
                      <Image
                        src={sprite}
                        alt={row.name}
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6 object-contain"
                      />
                    ) : null}
                    <span className="group-hover:underline">{row.name}</span>
                    {coreSlot === index ? (
                      <span className="rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                        Core
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">LFit {formatPercentOneDecimal(leagueFit)}</span>
                  </Badge>
                </Link>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Coverage Score {Math.round(analysis.score * 100)}%</Badge>
            <Badge variant="outline">Team Coverage {formatPercent(analysis.coverageRatio)}</Badge>
            <Badge variant="outline">Avg League Fit {formatPercentOneDecimal(analysis.avgLeagueFit)}</Badge>
            <Badge variant="outline">Type Diversity {formatPercent(analysis.diversityRatio)}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium">Covered Weaknesses</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.coveredTypes.length > 0 ? (
                  analysis.coveredTypes.map((type) => (
                    <TypeBadge key={`covered-${type}`} type={formatTypeName(type)} />
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs">No covered weakness interactions yet.</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Uncovered Weaknesses</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.uncoveredTypes.length > 0 ? (
                  analysis.uncoveredTypes.map((type) => (
                    <TypeBadge key={`uncovered-${type}`} type={formatTypeName(type)} />
                  ))
                ) : (
                  <p className="text-xs font-medium">No uncovered weaknesses detected.</p>
                )}
              </div>
            </div>
          </div>

          {analysis.uncoveredTypes.length > 0 ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Priority fix: add resistance to{" "}
                {analysis.uncoveredTypes
                  .slice(0, 3)
                  .map((type) => formatTypeName(type))
                  .join(", ")}
                {analysis.uncoveredTypes.length > 3 ? ", ..." : ""}.
              </p>
            </div>
          ) : null}
          {replacementSuggestions ? (
            <div className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/10 p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 font-medium text-sky-700 dark:text-sky-300">
                  Suggested replacements for Slot {replacementSuggestions.replaceIndex + 1} (
                  {replacementSuggestions.replace.name}){" "}
                  {replacementSuggestions.focus === "core"
                    ? `focused on covering ${replacementSuggestions.coreName}'s weaknesses`
                    : "focused on uncovered team weaknesses"}
                </p>
                {replacementSuggestions.candidates[0] ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full rounded-full px-3 text-xs sm:h-7 sm:w-auto"
                    onClick={() => onApplySuggestion(replacementSuggestions.candidates[0].row.nat)}
                  >
                    Apply best
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {visibleSuggestions.map((candidate, index) => {
                  const sprite = getListSpriteUrl(candidate.row.nat, candidate.row.spriteUrl);
                  return (
                    <div
                      key={`replacement-${candidate.row.nat}`}
                      className="flex flex-col gap-2 rounded-md border border-sky-500/30 bg-background/70 px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-muted-foreground text-xs">#{index + 1}</span>
                        {sprite ? (
                          <Image
                            src={sprite}
                            alt={candidate.row.name}
                            width={24}
                            height={24}
                            unoptimized
                            className="size-6 object-contain"
                          />
                        ) : (
                          <span className="bg-muted size-6 rounded-full" />
                        )}
                        <span className="truncate text-sm font-medium sm:text-xs">{candidate.row.name}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px]">
                          {replacementSuggestions.focus === "core" ? (
                            <>
                              <span className="sm:hidden">Cov</span>
                              <span className="hidden sm:inline">Core Cov</span>
                            </>
                          ) : (
                            "Cov"
                          )}{" "}
                          {candidate.targetCoverage}
                        </Badge>
                        <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px]">
                          <span className="sm:hidden">Team</span>
                          <span className="hidden sm:inline">Team Cov</span>{" "}
                          {candidate.resistCoverage}
                        </Badge>
                        <Badge variant="outline" className="h-6 rounded-full px-2 text-[10px]">
                          LFit {formatPercentOneDecimal(candidate.leagueFit)}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-auto h-7 rounded-full px-2.5 text-[10px] sm:ml-0 sm:h-6 sm:px-2"
                          onClick={() => onApplySuggestion(candidate.row.nat)}
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hiddenSuggestionsCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() =>
                    setVisibleSuggestionCount((current) => current + REPLACEMENT_PAGE_SIZE)
                  }
                >
                  Show next {Math.min(REPLACEMENT_PAGE_SIZE, hiddenSuggestionsCount)} ({hiddenSuggestionsCount} left)
                </Button>
              ) : replacementSuggestions.candidates.length > DEFAULT_REPLACEMENT_VISIBLE ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE)}
                >
                  Show less
                </Button>
              ) : null}
            </div>
          ) : null}

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Top Threat Types</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={effectiveThreatFilter === "all" ? "secondary" : "outline"}
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setActiveThreatFilter("all")}
                >
                  All
                </Button>
                {analysis.topThreats.map((threat) => (
                  <Button
                    key={`threat-filter-${threat.type}`}
                    type="button"
                    size="sm"
                    variant={effectiveThreatFilter === threat.type ? "secondary" : "outline"}
                    className="h-7 rounded-full px-2.5 text-xs"
                    onClick={() =>
                      setActiveThreatFilter((current) =>
                        current === threat.type ? "all" : threat.type,
                      )
                    }
                  >
                    {formatTypeName(threat.type)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.topThreats.length > 0 ? (
                analysis.topThreats.map((threat) => (
                  <Badge key={`threat-${threat.type}`} variant="outline" className="gap-1.5">
                    <TypeBadge type={formatTypeName(threat.type)} />
                    <span className="text-xs">Net {threat.net.toFixed(2)}</span>
                    <span className="text-muted-foreground text-xs">Pressure {formatPercent(threat.pressure)}</span>
                  </Badge>
                ))
              ) : (
                <p className="text-muted-foreground text-xs">No significant threat concentrations.</p>
              )}
            </div>
          </div>

          {primaryThreat ? (
            <p className="text-muted-foreground text-xs">
              Most pressing pressure:{" "}
              <span className="font-medium">{formatTypeName(primaryThreat.type)}</span> (net{" "}
              {primaryThreat.net.toFixed(2)}).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Why This Score</CardTitle>
          <p className="text-muted-foreground text-sm">
            Weighted formula: Coverage 68% + League Fit 22% + Diversity 10%.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs uppercase">Coverage (68%)</p>
              <p className="mt-1 text-lg font-semibold">
                {formatPercent(analysis.scoreBreakdown.components.coverage)}
              </p>
              <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${clampPercent(analysis.scoreBreakdown.components.coverage * 100)}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Weighted: {formatPercent(analysis.scoreBreakdown.weighted.coverage)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs uppercase">League Fit (22%)</p>
              <p className="mt-1 text-lg font-semibold">
                {formatPercentOneDecimal(analysis.scoreBreakdown.components.leagueFit)}
              </p>
              <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${clampPercent(analysis.scoreBreakdown.components.leagueFit * 100)}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Weighted: {formatPercentOneDecimal(analysis.scoreBreakdown.weighted.leagueFit)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs uppercase">Diversity (10%)</p>
              <p className="mt-1 text-lg font-semibold">
                {formatPercent(analysis.scoreBreakdown.components.diversity)}
              </p>
              <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${clampPercent(analysis.scoreBreakdown.components.diversity * 100)}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Weighted: {formatPercent(analysis.scoreBreakdown.weighted.diversity)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Member Contributions</p>
            <div className="grid gap-2 md:grid-cols-3">
              {analysis.members.map((member) => (
                <div key={`member-${member.nat}`} className="rounded-md border p-3">
                  {(() => {
                    const memberSlotIndex = slots.findIndex((nat) => nat === member.nat);
                    const isCoreMember = memberSlotIndex >= 0 && memberSlotIndex === coreSlot;
                    return (
                  <div className="flex items-center gap-2">
                    {(() => {
                      const row = rowByNat.get(member.nat);
                      const sprite = row ? getListSpriteUrl(row.nat, row.spriteUrl) : undefined;
                      return sprite ? (
                        <Image
                          src={sprite}
                          alt={member.name}
                          width={24}
                          height={24}
                          unoptimized
                          className="size-6 object-contain"
                        />
                      ) : (
                        <span className="bg-muted size-6 rounded-full" />
                      );
                    })()}
                    <Link
                      href={`/pokemon/${encodeURIComponent(member.nat)}`}
                      className="text-sm font-semibold underline-offset-4 hover:underline"
                    >
                      {member.name}
                    </Link>
                    {isCoreMember ? (
                      <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
                        Core
                      </Badge>
                    ) : null}
                  </div>
                    );
                  })()}
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    LFit {formatPercentOneDecimal(member.leagueFit)}
                  </p>
                  <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-sky-500"
                      style={{ width: `${clampPercent(member.leagueFit * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {member.coversForTeam.length > 0 ? (
                      member.coversForTeam.map((type) => (
                        <TypeBadge key={`member-cover-${member.nat}-${type}`} type={formatTypeName(type)} />
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">No direct teammate coverage.</span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Unique coverage:{" "}
                    {member.uniqueCoverage.length > 0
                      ? member.uniqueCoverage.map((type) => formatTypeName(type)).join(", ")
                      : "none"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Threat Pressure Breakdown</p>
            <div className="grid gap-2 md:grid-cols-2">
              {filteredTopThreats.map((threat) => (
                <div key={`pressure-${threat.type}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <TypeBadge type={formatTypeName(threat.type)} />
                    <Badge variant="outline">Pressure {formatPercent(threat.pressure)}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Weakness load {threat.weaknessWeight.toFixed(2)} vs resist support{" "}
                    {threat.resistanceWeight.toFixed(2)} (net {threat.net.toFixed(2)}).
                  </p>
                </div>
              ))}
              {filteredTopThreats.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {effectiveThreatFilter === "all"
                    ? "No active threat pressure detected."
                    : `No threat pressure details for ${formatTypeName(effectiveThreatFilter)}.`}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Local Presets</CardTitle>
          <p className="text-muted-foreground text-sm">
            Saved in this browser only. Share link remains portable across devices.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Preset name (optional)"
              className="max-w-sm"
              aria-label="Preset name input"
            />
            <Button type="button" size="sm" onClick={onSavePreset}>
              <SaveIcon className="size-4" />
              Save preset
            </Button>
          </div>

          {savedPresets.length > 0 ? (
            <div className="space-y-2">
              {savedPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{preset.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {DETAIL_LEAGUE_OPTIONS[preset.league].shortLabel} | Slots:{" "}
                      {preset.slots.map((slot) => (slot ? slot : "empty")).join(", ")} | Core:{" "}
                      {preset.coreSlot === null ? "none" : `Slot ${preset.coreSlot + 1}`} |{" "}
                      {new Date(preset.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLeague(preset.league);
                        setSlots(sanitizeSlots(preset.slots, sortedRows));
                        setCoreSlot(parseCoreSlotValue(preset.coreSlot));
                        setVisibleSuggestionCount(DEFAULT_REPLACEMENT_VISIBLE);
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setSavedPresets((current) =>
                          current.filter((entry) => entry.id !== preset.id),
                        )
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No local presets yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
