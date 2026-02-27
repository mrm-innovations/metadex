"use client";

import Image from "next/image";
import {
  ArrowLeftRightIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  RefreshCwIcon,
  ShieldIcon,
  SwordsIcon,
  TimerIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TypeBadge } from "@/components/pokedex/type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DETAIL_LEAGUES, DETAIL_LEAGUE_OPTIONS, parseDetailLeague, type DetailLeague } from "@/lib/detail-league";
import { POGO_CPM_TABLE } from "@/lib/pvp";
import { cn } from "@/lib/utils";

type PokemonOption = {
  nat: string;
  name: string;
  type1: string;
  type2?: string;
  pogoAtk: number | null;
  pogoDef: number | null;
  pogoHp: number | null;
};

type MoveEntry = {
  id: string;
  name: string;
  type: string | null;
  power: number | null;
  energyGain: number | null;
  energyCost: number | null;
  turns: number | null;
};

type MovePool = {
  nat: string;
  baseNat: number | null;
  name: string;
  forms: string[];
  fastMoves: MoveEntry[];
  chargedMoves: MoveEntry[];
  eliteFastMoves: MoveEntry[];
  eliteChargedMoves: MoveEntry[];
};

type MatchupEvent = {
  turn: number;
  actor: "left" | "right";
  target: "left" | "right";
  action: "fast" | "charged";
  moveName: string;
  damage: number;
  shielded: boolean;
  shieldReason: "lethal" | "high_damage" | "low_hp" | null;
  effectiveness: number;
  targetHpAfter: number;
};

type MatchupResult = {
  winner: "left" | "right" | "draw";
  reason: "faint" | "turn_limit";
  turnsElapsed: number;
  timeline: MatchupEvent[];
  left: {
    name: string;
    hpRemaining: number;
    energyRemaining: number;
    shieldsRemaining: number;
  };
  right: {
    name: string;
    hpRemaining: number;
    energyRemaining: number;
    shieldsRemaining: number;
  };
};

type MatchupConfidence = {
  level: "high" | "medium" | "low";
  notes: string[];
};

type SideResolvedStats = {
  atk: number;
  def: number;
  hp: number;
  atkIv: number;
  defIv: number;
  hpIv: number;
  level: number;
  cp: number;
  ivPreset: IvPreset;
  levelPreset: LevelPreset;
};

type MatchupMeta = {
  confidence?: MatchupConfidence;
  left?: { stats?: SideResolvedStats };
  right?: { stats?: SideResolvedStats };
};

type TimelineFilter = "all" | "charged" | "shielded";
type IvPreset = "hundo" | "pvp_rank1" | "custom";
type LevelPreset = "auto" | "40" | "50" | "custom";
type SideProfileValidation = {
  error: string | null;
};

const DEFAULT_LEFT_NAT = "3";
const DEFAULT_RIGHT_NAT = "6";
const TIMELINE_PREVIEW = 12;
const TIMELINE_PAGE_SIZE = 10;

const IV_PRESET_OPTIONS: Array<{ value: IvPreset; label: string }> = [
  { value: "hundo", label: "Hundo (15/15/15)" },
  { value: "pvp_rank1", label: "PvP Rank #1" },
  { value: "custom", label: "Custom IVs" },
];

const LEVEL_PRESET_OPTIONS: Array<{ value: LevelPreset; label: string }> = [
  { value: "auto", label: "Auto (League cap)" },
  { value: "40", label: "Level 40" },
  { value: "50", label: "Level 50" },
  { value: "custom", label: "Custom level" },
];
const CPM_SQUARED_BY_LEVEL = new Map(POGO_CPM_TABLE.map((entry) => [entry.level, entry.cpmSquared]));

function formatLevel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseIntInRange(
  value: string,
  min: number,
  max: number,
): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function parseLevelInRange(value: string): number | null {
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
    return null;
  }
  if (Math.round(parsed * 2) !== parsed * 2) {
    return null;
  }
  return Math.round(parsed * 2) / 2;
}

function calculateCp(
  baseAtk: number,
  baseDef: number,
  baseHp: number,
  atkIv: number,
  defIv: number,
  hpIv: number,
  cpmSquared: number,
): number {
  return Math.floor(
    (((baseAtk + atkIv) * Math.sqrt(baseDef + defIv) * Math.sqrt(baseHp + hpIv) * cpmSquared) / 10),
  );
}

function formatNatLabel(nat: string): string {
  const parsed = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
    return `#${String(parsed).padStart(3, "0")}`;
  }
  return `#${nat}`;
}

function getListSpriteUrl(nat: string): string | undefined {
  const parsedNat = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (Number.isFinite(parsedNat) && parsedNat > 0) {
    const dexId = Math.floor(parsedNat);
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
  }
  return undefined;
}

function MoveMetaChips({
  move,
  category,
  label,
}: {
  move: MoveEntry | null;
  category: "fast" | "charged";
  label: string;
}) {
  const power = move?.power ?? 0;
  const turns = move?.turns ?? 0;
  const energyValue = category === "fast" ? move?.energyGain ?? 0 : move?.energyCost ?? 0;
  const energyLabel = category === "fast" ? `+Energy ${energyValue}` : `Cost ${energyValue}`;

  return (
    <div className="bg-muted/30 flex items-center gap-1.5 rounded-md border px-2 py-1">
      <span className="text-muted-foreground text-[10px] font-medium">{label}</span>
      <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
        Power {power}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          "h-5 rounded-full px-1.5 text-[10px]",
          category === "fast"
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        )}
      >
        {energyLabel}
      </Badge>
      <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
        Turns {turns}
      </Badge>
    </div>
  );
}

function formatShieldReason(reason: MatchupEvent["shieldReason"]): string | null {
  if (!reason) {
    return null;
  }
  if (reason === "lethal") {
    return "Lethal block";
  }
  if (reason === "high_damage") {
    return "High damage";
  }
  return "Low HP preserve";
}

function getActionBadgeClass(action: MatchupEvent["action"]): string {
  if (action === "charged") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

function getDerivedInitialHp(result: MatchupResult, target: "left" | "right"): number {
  const events = result.timeline.filter((event) => event.target === target);
  if (events.length === 0) {
    return target === "left" ? Math.max(1, result.left.hpRemaining) : Math.max(1, result.right.hpRemaining);
  }

  let inferred = 0;
  for (const event of events) {
    inferred = Math.max(inferred, event.targetHpAfter + Math.max(0, event.damage));
  }

  const current = target === "left" ? result.left.hpRemaining : result.right.hpRemaining;
  return Math.max(1, inferred, current);
}

function dedupeMoves(moves: MoveEntry[]): MoveEntry[] {
  const seen = new Set<string>();
  const values: MoveEntry[] = [];
  for (const move of moves) {
    if (seen.has(move.id)) {
      continue;
    }
    seen.add(move.id);
    values.push(move);
  }
  return values;
}

function buildFastMoves(pool: MovePool | null): MoveEntry[] {
  if (!pool) {
    return [];
  }
  return dedupeMoves([...pool.fastMoves, ...pool.eliteFastMoves]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function buildChargedMoves(pool: MovePool | null): MoveEntry[] {
  if (!pool) {
    return [];
  }
  return dedupeMoves([...pool.chargedMoves, ...pool.eliteChargedMoves]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

async function fetchMovePool(nat: string): Promise<MovePool> {
  const response = await fetch(`/api/moves?nat=${encodeURIComponent(nat)}`);
  const json = (await response.json()) as {
    data?: MovePool;
    error?: string;
  };

  if (!response.ok || !json.data) {
    throw new Error(json.error ?? "Failed to load Pokemon move pool.");
  }

  return json.data;
}

function getDefaultNat(rows: PokemonOption[], fallback: string): string {
  if (rows.some((row) => row.nat === fallback)) {
    return fallback;
  }
  return rows[0]?.nat ?? fallback;
}

function PokemonSelectCombobox({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: PokemonOption[];
  onValueChange: (nat: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((row) => row.nat === value) ?? null;
  const selectedIcon = selected ? getListSpriteUrl(selected.nat) : undefined;

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
                width={18}
                height={18}
                unoptimized
                className="size-[18px] object-contain"
              />
            ) : (
              <span className="bg-muted size-[18px] rounded-full" />
            )}
            <span className="truncate">
              {selected ? `${selected.name} (${formatNatLabel(selected.nat)})` : "Select Pokemon"}
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
                const icon = getListSpriteUrl(row.nat);
                return (
                  <CommandItem
                    key={`poke-option-${row.nat}-${row.name}`}
                    value={`${row.name} ${row.nat} ${formatNatLabel(row.nat)}`}
                    onSelect={() => {
                      onValueChange(row.nat);
                      setOpen(false);
                    }}
                  >
                    <CheckIcon
                      className={cn("size-4", row.nat === value ? "opacity-100" : "opacity-0")}
                    />
                    {icon ? (
                      <Image
                        src={icon}
                        alt={row.name}
                        width={18}
                        height={18}
                        unoptimized
                        className="size-[18px] object-contain"
                      />
                    ) : (
                      <span className="bg-muted size-[18px] rounded-full" />
                    )}
                    <span className="truncate">{row.name}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatNatLabel(row.nat)}
                    </span>
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

function SideProfileControls({
  sideLabel,
  ivPreset,
  onIvPresetChange,
  levelPreset,
  onLevelPresetChange,
  customLevel,
  onCustomLevelChange,
  atkIv,
  defIv,
  hpIv,
  onAtkIvChange,
  onDefIvChange,
  onHpIvChange,
  resolvedStats,
  validationError,
}: {
  sideLabel: "Left" | "Right";
  ivPreset: IvPreset;
  onIvPresetChange: (value: IvPreset) => void;
  levelPreset: LevelPreset;
  onLevelPresetChange: (value: LevelPreset) => void;
  customLevel: string;
  onCustomLevelChange: (value: string) => void;
  atkIv: string;
  defIv: string;
  hpIv: string;
  onAtkIvChange: (value: string) => void;
  onDefIvChange: (value: string) => void;
  onHpIvChange: (value: string) => void;
  resolvedStats: SideResolvedStats | null;
  validationError: string | null;
}) {
  return (
    <div className="w-full space-y-2 rounded-md border border-border/60 p-2">
      <p className="text-muted-foreground text-[11px] font-medium">{sideLabel} stat profile</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={ivPreset} onValueChange={(value) => onIvPresetChange(value as IvPreset)}>
          <SelectTrigger aria-label={`${sideLabel} IV preset selector`}>
            <SelectValue placeholder="IV preset" />
          </SelectTrigger>
          <SelectContent>
            {IV_PRESET_OPTIONS.map((option) => (
              <SelectItem key={`${sideLabel}-iv-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelPreset} onValueChange={(value) => onLevelPresetChange(value as LevelPreset)}>
          <SelectTrigger aria-label={`${sideLabel} level preset selector`}>
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            {LEVEL_PRESET_OPTIONS.map((option) => (
              <SelectItem key={`${sideLabel}-level-${option.value}`} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {ivPreset === "custom" ? (
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            min={0}
            max={15}
            value={atkIv}
            onChange={(event) => onAtkIvChange(event.target.value)}
            aria-label={`${sideLabel} ATK IV input`}
            placeholder="ATK IV"
          />
          <Input
            type="number"
            min={0}
            max={15}
            value={defIv}
            onChange={(event) => onDefIvChange(event.target.value)}
            aria-label={`${sideLabel} DEF IV input`}
            placeholder="DEF IV"
          />
          <Input
            type="number"
            min={0}
            max={15}
            value={hpIv}
            onChange={(event) => onHpIvChange(event.target.value)}
            aria-label={`${sideLabel} HP IV input`}
            placeholder="HP IV"
          />
        </div>
      ) : null}
      {ivPreset !== "pvp_rank1" && levelPreset === "custom" ? (
        <Input
          type="number"
          min={1}
          max={50}
          step={0.5}
          value={customLevel}
          onChange={(event) => onCustomLevelChange(event.target.value)}
          aria-label={`${sideLabel} custom level input`}
          placeholder="Level (1-50, 0.5)"
        />
      ) : null}
      {ivPreset === "pvp_rank1" ? (
        <p className="text-muted-foreground text-[10px]">
          Uses league-specific rank #1 IVs and level.
        </p>
      ) : null}
      {resolvedStats ? (
        <div className="flex flex-wrap gap-1.5" data-testid={`${sideLabel.toLowerCase()}-resolved-profile`}>
          <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
            IV {resolvedStats.atkIv}/{resolvedStats.defIv}/{resolvedStats.hpIv}
          </Badge>
          <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
            L{formatLevel(resolvedStats.level)}
          </Badge>
          <Badge variant="outline" className="h-5 rounded-full px-1.5 text-[10px]">
            CP {resolvedStats.cp.toLocaleString()}
          </Badge>
        </div>
      ) : null}
      {validationError ? (
        <p
          className="text-[10px] text-rose-600 dark:text-rose-400"
          data-testid={`${sideLabel.toLowerCase()}-profile-warning`}
        >
          {validationError}
        </p>
      ) : null}
    </div>
  );
}

export function MatchupSimulator({ rows }: { rows: PokemonOption[] }) {
  const leftDefault = getDefaultNat(rows, DEFAULT_LEFT_NAT);
  const rightDefault = getDefaultNat(rows, DEFAULT_RIGHT_NAT);

  const [league, setLeague] = useState<DetailLeague>("great");
  const [leftNat, setLeftNat] = useState(leftDefault);
  const [rightNat, setRightNat] = useState(rightDefault === leftDefault ? rows[1]?.nat ?? rightDefault : rightDefault);
  const [leftShields, setLeftShields] = useState("2");
  const [rightShields, setRightShields] = useState("2");
  const [maxTurns, setMaxTurns] = useState("300");
  const [leftIvPreset, setLeftIvPreset] = useState<IvPreset>("hundo");
  const [rightIvPreset, setRightIvPreset] = useState<IvPreset>("hundo");
  const [leftLevelPreset, setLeftLevelPreset] = useState<LevelPreset>("auto");
  const [rightLevelPreset, setRightLevelPreset] = useState<LevelPreset>("auto");
  const [leftCustomLevel, setLeftCustomLevel] = useState("40");
  const [rightCustomLevel, setRightCustomLevel] = useState("40");
  const [leftAtkIv, setLeftAtkIv] = useState("15");
  const [leftDefIv, setLeftDefIv] = useState("15");
  const [leftHpIv, setLeftHpIv] = useState("15");
  const [rightAtkIv, setRightAtkIv] = useState("15");
  const [rightDefIv, setRightDefIv] = useState("15");
  const [rightHpIv, setRightHpIv] = useState("15");

  const [leftPool, setLeftPool] = useState<MovePool | null>(null);
  const [rightPool, setRightPool] = useState<MovePool | null>(null);
  const [leftFastId, setLeftFastId] = useState("");
  const [leftChargedId, setLeftChargedId] = useState("");
  const [rightFastId, setRightFastId] = useState("");
  const [rightChargedId, setRightChargedId] = useState("");
  const [leftPoolLoading, setLeftPoolLoading] = useState(false);
  const [rightPoolLoading, setRightPoolLoading] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchupResult | null>(null);
  const [resultConfidence, setResultConfidence] = useState<MatchupConfidence | null>(null);
  const [leftResolvedStats, setLeftResolvedStats] = useState<SideResolvedStats | null>(null);
  const [rightResolvedStats, setRightResolvedStats] = useState<SideResolvedStats | null>(null);
  const [visibleTimelineCount, setVisibleTimelineCount] = useState(TIMELINE_PREVIEW);
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("all");
  const [isSwapping, setIsSwapping] = useState(false);
  const [urlHydrated, setUrlHydrated] = useState(false);
  const swapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leftFastMoves = useMemo(() => buildFastMoves(leftPool), [leftPool]);
  const leftChargedMoves = useMemo(() => buildChargedMoves(leftPool), [leftPool]);
  const rightFastMoves = useMemo(() => buildFastMoves(rightPool), [rightPool]);
  const rightChargedMoves = useMemo(() => buildChargedMoves(rightPool), [rightPool]);

  const leftSelected = useMemo(
    () => rows.find((row) => row.nat === leftNat) ?? null,
    [leftNat, rows],
  );
  const rightSelected = useMemo(
    () => rows.find((row) => row.nat === rightNat) ?? null,
    [rightNat, rows],
  );
  const leftSelectedSprite = useMemo(
    () => (leftSelected ? getListSpriteUrl(leftSelected.nat) : undefined),
    [leftSelected],
  );
  const rightSelectedSprite = useMemo(
    () => (rightSelected ? getListSpriteUrl(rightSelected.nat) : undefined),
    [rightSelected],
  );
  const leftFastSelected = useMemo(
    () => leftFastMoves.find((move) => move.id === leftFastId) ?? null,
    [leftFastId, leftFastMoves],
  );
  const leftChargedSelected = useMemo(
    () => leftChargedMoves.find((move) => move.id === leftChargedId) ?? null,
    [leftChargedId, leftChargedMoves],
  );
  const rightFastSelected = useMemo(
    () => rightFastMoves.find((move) => move.id === rightFastId) ?? null,
    [rightFastId, rightFastMoves],
  );
  const rightChargedSelected = useMemo(
    () => rightChargedMoves.find((move) => move.id === rightChargedId) ?? null,
    [rightChargedId, rightChargedMoves],
  );
  const validNats = useMemo(() => new Set(rows.map((row) => row.nat)), [rows]);
  const leagueCap = DETAIL_LEAGUE_OPTIONS[league].pvpCap;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const leftNatParam = params.get("leftNat")?.trim();
    const rightNatParam = params.get("rightNat")?.trim();
    const parsedLeague = parseDetailLeague(params.get("league"), "great");
    const leftShieldsParam = params.get("leftShields");
    const rightShieldsParam = params.get("rightShields");
    const maxTurnsParam = params.get("maxTurns");
    const leftFastParam = params.get("leftFast")?.trim();
    const rightFastParam = params.get("rightFast")?.trim();
    const leftChargedParam = params.get("leftCharged")?.trim();
    const rightChargedParam = params.get("rightCharged")?.trim();
    const leftIvPresetParam = (params.get("leftIvPreset") ?? "").trim().toLowerCase();
    const rightIvPresetParam = (params.get("rightIvPreset") ?? "").trim().toLowerCase();
    const leftLevelPresetParam = (params.get("leftLevelPreset") ?? "").trim().toLowerCase();
    const rightLevelPresetParam = (params.get("rightLevelPreset") ?? "").trim().toLowerCase();
    const leftLevelParam = params.get("leftLevel")?.trim();
    const rightLevelParam = params.get("rightLevel")?.trim();
    const leftAtkIvParam = params.get("leftAtkIv")?.trim();
    const leftDefIvParam = params.get("leftDefIv")?.trim();
    const leftHpIvParam = params.get("leftHpIv")?.trim();
    const rightAtkIvParam = params.get("rightAtkIv")?.trim();
    const rightDefIvParam = params.get("rightDefIv")?.trim();
    const rightHpIvParam = params.get("rightHpIv")?.trim();

    setLeague(parsedLeague);
    if (leftNatParam && validNats.has(leftNatParam)) {
      setLeftNat(leftNatParam);
    }
    if (rightNatParam && validNats.has(rightNatParam)) {
      setRightNat(rightNatParam);
    }
    if (leftShieldsParam === "0" || leftShieldsParam === "1" || leftShieldsParam === "2") {
      setLeftShields(leftShieldsParam);
    }
    if (rightShieldsParam === "0" || rightShieldsParam === "1" || rightShieldsParam === "2") {
      setRightShields(rightShieldsParam);
    }
    if (maxTurnsParam && Number.isFinite(Number.parseInt(maxTurnsParam, 10))) {
      const parsedMaxTurns = Number.parseInt(maxTurnsParam, 10);
      if (parsedMaxTurns >= 20 && parsedMaxTurns <= 1000) {
        setMaxTurns(String(parsedMaxTurns));
      }
    }
    if (leftFastParam) {
      setLeftFastId(leftFastParam);
    }
    if (rightFastParam) {
      setRightFastId(rightFastParam);
    }
    if (leftChargedParam) {
      setLeftChargedId(leftChargedParam);
    }
    if (rightChargedParam) {
      setRightChargedId(rightChargedParam);
    }
    if (
      leftIvPresetParam === "hundo" ||
      leftIvPresetParam === "pvp_rank1" ||
      leftIvPresetParam === "custom"
    ) {
      setLeftIvPreset(leftIvPresetParam);
    }
    if (
      rightIvPresetParam === "hundo" ||
      rightIvPresetParam === "pvp_rank1" ||
      rightIvPresetParam === "custom"
    ) {
      setRightIvPreset(rightIvPresetParam);
    }
    if (
      leftLevelPresetParam === "auto" ||
      leftLevelPresetParam === "40" ||
      leftLevelPresetParam === "50" ||
      leftLevelPresetParam === "custom"
    ) {
      setLeftLevelPreset(leftLevelPresetParam);
    }
    if (
      rightLevelPresetParam === "auto" ||
      rightLevelPresetParam === "40" ||
      rightLevelPresetParam === "50" ||
      rightLevelPresetParam === "custom"
    ) {
      setRightLevelPreset(rightLevelPresetParam);
    }
    if (leftLevelParam) {
      setLeftCustomLevel(leftLevelParam);
    }
    if (rightLevelParam) {
      setRightCustomLevel(rightLevelParam);
    }
    if (leftAtkIvParam) {
      setLeftAtkIv(leftAtkIvParam);
    }
    if (leftDefIvParam) {
      setLeftDefIv(leftDefIvParam);
    }
    if (leftHpIvParam) {
      setLeftHpIv(leftHpIvParam);
    }
    if (rightAtkIvParam) {
      setRightAtkIv(rightAtkIvParam);
    }
    if (rightDefIvParam) {
      setRightDefIv(rightDefIvParam);
    }
    if (rightHpIvParam) {
      setRightHpIv(rightHpIvParam);
    }
    setUrlHydrated(true);
  }, [validNats]);

  useEffect(() => {
    if (!urlHydrated || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams();
    params.set("league", league);
    params.set("leftNat", leftNat);
    params.set("rightNat", rightNat);
    params.set("leftFast", leftFastId);
    params.set("leftCharged", leftChargedId);
    params.set("rightFast", rightFastId);
    params.set("rightCharged", rightChargedId);
    params.set("leftShields", leftShields);
    params.set("rightShields", rightShields);
    params.set("maxTurns", maxTurns);
    params.set("leftIvPreset", leftIvPreset);
    params.set("rightIvPreset", rightIvPreset);
    params.set("leftLevelPreset", leftLevelPreset);
    params.set("rightLevelPreset", rightLevelPreset);
    params.set("leftLevel", leftCustomLevel);
    params.set("rightLevel", rightCustomLevel);
    params.set("leftAtkIv", leftAtkIv);
    params.set("leftDefIv", leftDefIv);
    params.set("leftHpIv", leftHpIv);
    params.set("rightAtkIv", rightAtkIv);
    params.set("rightDefIv", rightDefIv);
    params.set("rightHpIv", rightHpIv);

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [
    leftAtkIv,
    leftChargedId,
    leftCustomLevel,
    leftDefIv,
    leftFastId,
    leftHpIv,
    leftIvPreset,
    leftLevelPreset,
    leftNat,
    leftShields,
    league,
    maxTurns,
    rightAtkIv,
    rightChargedId,
    rightCustomLevel,
    rightDefIv,
    rightFastId,
    rightHpIv,
    rightIvPreset,
    rightLevelPreset,
    rightNat,
    rightShields,
    urlHydrated,
  ]);

  const leftProfileValidation = useMemo<SideProfileValidation>(() => {
    if (!leftSelected) {
      return { error: null };
    }
    if (leftIvPreset === "pvp_rank1" || leftLevelPreset === "auto") {
      return { error: null };
    }
    if (
      leftSelected.pogoAtk === null ||
      leftSelected.pogoDef === null ||
      leftSelected.pogoHp === null
    ) {
      return { error: "Missing GO base stats for profile validation." };
    }

    let atkIv = 15;
    let defIv = 15;
    let hpIv = 15;
    if (leftIvPreset === "custom") {
      const parsedAtk = parseIntInRange(leftAtkIv, 0, 15);
      const parsedDef = parseIntInRange(leftDefIv, 0, 15);
      const parsedHp = parseIntInRange(leftHpIv, 0, 15);
      if (parsedAtk === null || parsedDef === null || parsedHp === null) {
        return { error: "Custom IVs must be integers between 0 and 15." };
      }
      atkIv = parsedAtk;
      defIv = parsedDef;
      hpIv = parsedHp;
    }

    const level =
      leftLevelPreset === "40"
        ? 40
        : leftLevelPreset === "50"
          ? 50
          : parseLevelInRange(leftCustomLevel);
    if (level === null) {
      return { error: "Custom level must be 1-50 in 0.5 steps." };
    }

    const cpmSquared = CPM_SQUARED_BY_LEVEL.get(level);
    if (!cpmSquared) {
      return { error: `Level ${formatLevel(level)} is not supported.` };
    }

    const cp = calculateCp(
      leftSelected.pogoAtk,
      leftSelected.pogoDef,
      leftSelected.pogoHp,
      atkIv,
      defIv,
      hpIv,
      cpmSquared,
    );
    if (Number.isFinite(leagueCap) && cp > leagueCap) {
      return { error: `CP ${cp.toLocaleString()} exceeds ${DETAIL_LEAGUE_OPTIONS[league].shortLabel} cap ${leagueCap.toLocaleString()}.` };
    }
    return { error: null };
  }, [
    leftAtkIv,
    leftCustomLevel,
    leftDefIv,
    leftHpIv,
    leftIvPreset,
    leftLevelPreset,
    leftSelected,
    league,
    leagueCap,
  ]);

  const rightProfileValidation = useMemo<SideProfileValidation>(() => {
    if (!rightSelected) {
      return { error: null };
    }
    if (rightIvPreset === "pvp_rank1" || rightLevelPreset === "auto") {
      return { error: null };
    }
    if (
      rightSelected.pogoAtk === null ||
      rightSelected.pogoDef === null ||
      rightSelected.pogoHp === null
    ) {
      return { error: "Missing GO base stats for profile validation." };
    }

    let atkIv = 15;
    let defIv = 15;
    let hpIv = 15;
    if (rightIvPreset === "custom") {
      const parsedAtk = parseIntInRange(rightAtkIv, 0, 15);
      const parsedDef = parseIntInRange(rightDefIv, 0, 15);
      const parsedHp = parseIntInRange(rightHpIv, 0, 15);
      if (parsedAtk === null || parsedDef === null || parsedHp === null) {
        return { error: "Custom IVs must be integers between 0 and 15." };
      }
      atkIv = parsedAtk;
      defIv = parsedDef;
      hpIv = parsedHp;
    }

    const level =
      rightLevelPreset === "40"
        ? 40
        : rightLevelPreset === "50"
          ? 50
          : parseLevelInRange(rightCustomLevel);
    if (level === null) {
      return { error: "Custom level must be 1-50 in 0.5 steps." };
    }

    const cpmSquared = CPM_SQUARED_BY_LEVEL.get(level);
    if (!cpmSquared) {
      return { error: `Level ${formatLevel(level)} is not supported.` };
    }

    const cp = calculateCp(
      rightSelected.pogoAtk,
      rightSelected.pogoDef,
      rightSelected.pogoHp,
      atkIv,
      defIv,
      hpIv,
      cpmSquared,
    );
    if (Number.isFinite(leagueCap) && cp > leagueCap) {
      return { error: `CP ${cp.toLocaleString()} exceeds ${DETAIL_LEAGUE_OPTIONS[league].shortLabel} cap ${leagueCap.toLocaleString()}.` };
    }
    return { error: null };
  }, [
    league,
    leagueCap,
    rightAtkIv,
    rightCustomLevel,
    rightDefIv,
    rightHpIv,
    rightIvPreset,
    rightLevelPreset,
    rightSelected,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLeftPoolLoading(true);
      try {
        const pool = await fetchMovePool(leftNat);
        if (cancelled) {
          return;
        }
        setLeftPool(pool);

        const fastOptions = buildFastMoves(pool);
        const chargedOptions = buildChargedMoves(pool);
        setLeftFastId((current) =>
          fastOptions.some((move) => move.id === current) ? current : (fastOptions[0]?.id ?? ""),
        );
        setLeftChargedId((current) =>
          chargedOptions.some((move) => move.id === current)
            ? current
            : (chargedOptions[0]?.id ?? ""),
        );
      } catch (error) {
        if (!cancelled) {
          setLeftPool(null);
          setResultError(error instanceof Error ? error.message : "Failed to load left move pool.");
        }
      } finally {
        if (!cancelled) {
          setLeftPoolLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [leftNat]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setRightPoolLoading(true);
      try {
        const pool = await fetchMovePool(rightNat);
        if (cancelled) {
          return;
        }
        setRightPool(pool);

        const fastOptions = buildFastMoves(pool);
        const chargedOptions = buildChargedMoves(pool);
        setRightFastId((current) =>
          fastOptions.some((move) => move.id === current) ? current : (fastOptions[0]?.id ?? ""),
        );
        setRightChargedId((current) =>
          chargedOptions.some((move) => move.id === current)
            ? current
            : (chargedOptions[0]?.id ?? ""),
        );
      } catch (error) {
        if (!cancelled) {
          setRightPool(null);
          setResultError(error instanceof Error ? error.message : "Failed to load right move pool.");
        }
      } finally {
        if (!cancelled) {
          setRightPoolLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [rightNat]);

  const canSimulate =
    urlHydrated &&
    Boolean(leftNat) &&
    Boolean(rightNat) &&
    Boolean(leftFastId) &&
    Boolean(leftChargedId) &&
    Boolean(rightFastId) &&
    Boolean(rightChargedId) &&
    !leftProfileValidation.error &&
    !rightProfileValidation.error &&
    !leftPoolLoading &&
    !rightPoolLoading;

  const runSimulation = useCallback(async () => {
    if (!canSimulate) {
      return;
    }
    setResultLoading(true);
    setResultError(null);
    setVisibleTimelineCount(TIMELINE_PREVIEW);
    setTimelineFilter("all");

    const params = new URLSearchParams({
      league,
      leftNat,
      rightNat,
      leftFast: leftFastId,
      leftCharged: leftChargedId,
      rightFast: rightFastId,
      rightCharged: rightChargedId,
      leftShields,
      rightShields,
      maxTurns,
      timeline: "1",
      leftIvPreset,
      rightIvPreset,
      leftLevelPreset,
      rightLevelPreset,
      leftLevel: leftCustomLevel,
      rightLevel: rightCustomLevel,
      leftAtkIv,
      leftDefIv,
      leftHpIv,
      rightAtkIv,
      rightDefIv,
      rightHpIv,
    });

    try {
      const response = await fetch(`/api/matchup?${params.toString()}`);
      const json = (await response.json()) as {
        data?: MatchupResult;
        meta?: MatchupMeta;
        error?: string;
        message?: string;
      };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? json.message ?? "Simulation request failed.");
      }
      setResult(json.data);
      setResultConfidence(json.meta?.confidence ?? null);
      setLeftResolvedStats(json.meta?.left?.stats ?? null);
      setRightResolvedStats(json.meta?.right?.stats ?? null);
    } catch (error) {
      setResult(null);
      setResultConfidence(null);
      setLeftResolvedStats(null);
      setRightResolvedStats(null);
      setResultError(error instanceof Error ? error.message : "Unable to simulate matchup.");
    } finally {
      setResultLoading(false);
    }
  }, [
    canSimulate,
    league,
    leftChargedId,
    leftFastId,
    leftAtkIv,
    leftCustomLevel,
    leftDefIv,
    leftHpIv,
    leftIvPreset,
    leftLevelPreset,
    leftNat,
    leftShields,
    maxTurns,
    rightAtkIv,
    rightCustomLevel,
    rightDefIv,
    rightHpIv,
    rightIvPreset,
    rightLevelPreset,
    rightChargedId,
    rightFastId,
    rightNat,
    rightShields,
  ]);

  useEffect(() => {
    if (!canSimulate || resultLoading || result) {
      return;
    }
    void runSimulation();
  }, [canSimulate, result, resultLoading, runSimulation]);

  useEffect(() => {
    setResult(null);
    setResultConfidence(null);
    setLeftResolvedStats(null);
    setRightResolvedStats(null);
    setResultError(null);
  }, [
    league,
    leftNat,
    rightNat,
    leftFastId,
    leftChargedId,
    rightFastId,
    rightChargedId,
    leftIvPreset,
    rightIvPreset,
    leftLevelPreset,
    rightLevelPreset,
    leftCustomLevel,
    rightCustomLevel,
    leftAtkIv,
    leftDefIv,
    leftHpIv,
    rightAtkIv,
    rightDefIv,
    rightHpIv,
    leftShields,
    rightShields,
    maxTurns,
  ]);

  useEffect(() => {
    return () => {
      if (swapTimeoutRef.current) {
        clearTimeout(swapTimeoutRef.current);
      }
    };
  }, []);

  const filteredTimeline = useMemo(() => {
    if (!result) {
      return [];
    }
    if (timelineFilter === "charged") {
      return result.timeline.filter((event) => event.action === "charged");
    }
    if (timelineFilter === "shielded") {
      return result.timeline.filter((event) => event.shielded);
    }
    return result.timeline;
  }, [result, timelineFilter]);
  const timelineRows = useMemo(() => {
    return filteredTimeline.slice(0, visibleTimelineCount);
  }, [filteredTimeline, visibleTimelineCount]);
  const hiddenTimelineCount = useMemo(() => {
    return Math.max(0, filteredTimeline.length - visibleTimelineCount);
  }, [filteredTimeline.length, visibleTimelineCount]);
  const timelineFilterCounts = useMemo(() => {
    if (!result) {
      return { all: 0, charged: 0, shielded: 0 };
    }
    return {
      all: result.timeline.length,
      charged: result.timeline.filter((event) => event.action === "charged").length,
      shielded: result.timeline.filter((event) => event.shielded).length,
    };
  }, [result]);

  const matchupInsights = useMemo(() => {
    if (!result) {
      return null;
    }

    let leftFastDamage = 0;
    let leftChargedDamage = 0;
    let rightFastDamage = 0;
    let rightChargedDamage = 0;
    const leftShieldReasons = new Set<string>();
    const rightShieldReasons = new Set<string>();

    for (const event of result.timeline) {
      if (event.actor === "left") {
        if (event.action === "fast") {
          leftFastDamage += event.damage;
        } else {
          leftChargedDamage += event.damage;
        }
      } else if (event.action === "fast") {
        rightFastDamage += event.damage;
      } else {
        rightChargedDamage += event.damage;
      }

      if (event.shielded) {
        const reasonLabel = formatShieldReason(event.shieldReason);
        if (reasonLabel) {
          if (event.target === "left") {
            leftShieldReasons.add(reasonLabel);
          } else {
            rightShieldReasons.add(reasonLabel);
          }
        }
      }
    }

    const chargedUnshielded = result.timeline.filter(
      (event) => event.action === "charged" && !event.shielded,
    );
    const swingPool = chargedUnshielded.length > 0 ? chargedUnshielded : result.timeline;
    const keySwing =
      [...swingPool].sort(
        (a, b) =>
          b.damage - a.damage ||
          b.effectiveness - a.effectiveness ||
          a.turn - b.turn,
      )[0] ?? null;

    return {
      keySwing,
      leftFastDamage,
      leftChargedDamage,
      rightFastDamage,
      rightChargedDamage,
      leftShieldReasons: [...leftShieldReasons],
      rightShieldReasons: [...rightShieldReasons],
    };
  }, [result]);

  const explainabilityScorecard = useMemo(() => {
    if (!result || !matchupInsights) {
      return null;
    }

    const leftStartShields = Number.parseInt(leftShields, 10);
    const rightStartShields = Number.parseInt(rightShields, 10);
    const leftUsedShields = Number.isFinite(leftStartShields)
      ? Math.max(0, leftStartShields - result.left.shieldsRemaining)
      : 0;
    const rightUsedShields = Number.isFinite(rightStartShields)
      ? Math.max(0, rightStartShields - result.right.shieldsRemaining)
      : 0;

    const leftBlocked = result.timeline.filter(
      (event) => event.shielded && event.target === "left",
    ).length;
    const rightBlocked = result.timeline.filter(
      (event) => event.shielded && event.target === "right",
    ).length;

    const leftShieldEff =
      leftUsedShields > 0 ? Math.round((leftBlocked / leftUsedShields) * 100) : null;
    const rightShieldEff =
      rightUsedShields > 0 ? Math.round((rightBlocked / rightUsedShields) * 100) : null;

    const chargedTurns = [...new Set(
      result.timeline
        .filter((event) => event.action === "charged")
        .map((event) => event.turn),
    )].sort((a, b) => a - b);

    let cmpWinner: "left" | "right" | null = null;
    let cmpTurn: number | null = null;
    for (const turn of chargedTurns) {
      const turnCharged = result.timeline.filter(
        (event) => event.turn === turn && event.action === "charged",
      );
      const actors = new Set(turnCharged.map((event) => event.actor));
      if (actors.has("left") && actors.has("right") && turnCharged.length >= 2) {
        cmpWinner = turnCharged[0]?.actor ?? null;
        cmpTurn = turn;
        break;
      }
    }

    const leftTotalDamage =
      matchupInsights.leftFastDamage + matchupInsights.leftChargedDamage;
    const rightTotalDamage =
      matchupInsights.rightFastDamage + matchupInsights.rightChargedDamage;
    const leftChargedPressure =
      leftTotalDamage > 0
        ? Math.round((matchupInsights.leftChargedDamage / leftTotalDamage) * 100)
        : 0;
    const rightChargedPressure =
      rightTotalDamage > 0
        ? Math.round((matchupInsights.rightChargedDamage / rightTotalDamage) * 100)
        : 0;

    const chargedPressureLeader =
      leftChargedPressure === rightChargedPressure
        ? "tie"
        : leftChargedPressure > rightChargedPressure
          ? "left"
          : "right";

    return {
      cmpWinner,
      cmpTurn,
      leftUsedShields,
      rightUsedShields,
      leftBlocked,
      rightBlocked,
      leftShieldEff,
      rightShieldEff,
      leftChargedPressure,
      rightChargedPressure,
      chargedPressureLeader,
    };
  }, [leftShields, matchupInsights, result, rightShields]);

  const hpSnapshot = useMemo(() => {
    if (!result) {
      return null;
    }
    const leftMax = getDerivedInitialHp(result, "left");
    const rightMax = getDerivedInitialHp(result, "right");
    return {
      leftMax,
      rightMax,
      leftPct: Math.max(0, Math.min(100, Math.round((result.left.hpRemaining / leftMax) * 100))),
      rightPct: Math.max(0, Math.min(100, Math.round((result.right.hpRemaining / rightMax) * 100))),
    };
  }, [result]);

  const swapSides = () => {
    if (swapTimeoutRef.current) {
      clearTimeout(swapTimeoutRef.current);
    }
    setIsSwapping(true);
    setLeftNat(rightNat);
    setRightNat(leftNat);
    setLeftShields(rightShields);
    setRightShields(leftShields);
    setLeftIvPreset(rightIvPreset);
    setRightIvPreset(leftIvPreset);
    setLeftLevelPreset(rightLevelPreset);
    setRightLevelPreset(leftLevelPreset);
    setLeftCustomLevel(rightCustomLevel);
    setRightCustomLevel(leftCustomLevel);
    setLeftAtkIv(rightAtkIv);
    setLeftDefIv(rightDefIv);
    setLeftHpIv(rightHpIv);
    setRightAtkIv(leftAtkIv);
    setRightDefIv(leftDefIv);
    setRightHpIv(leftHpIv);
    swapTimeoutRef.current = setTimeout(() => {
      setIsSwapping(false);
    }, 220);
  };

  return (
    <div className="space-y-4" data-testid="matchup-sim-page">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matchup Simulator</CardTitle>
          <p className="text-muted-foreground text-sm">
            Deterministic 1v1 preview using GO stats, move power/energy, type effectiveness, and shield logic.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <PokemonSelectCombobox
              label="Left Pokemon selector"
              value={leftNat}
              options={rows}
              onValueChange={setLeftNat}
            />

            <PokemonSelectCombobox
              label="Right Pokemon selector"
              value={rightNat}
              options={rows}
              onValueChange={setRightNat}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <Select value={league} onValueChange={(value) => setLeague(value as DetailLeague)}>
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

            <Select value={leftShields} onValueChange={setLeftShields}>
              <SelectTrigger aria-label="Left shields selector">
                <SelectValue placeholder="Left shields" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Left shields: 0</SelectItem>
                <SelectItem value="1">Left shields: 1</SelectItem>
                <SelectItem value="2">Left shields: 2</SelectItem>
              </SelectContent>
            </Select>

            <Select value={rightShields} onValueChange={setRightShields}>
              <SelectTrigger aria-label="Right shields selector">
                <SelectValue placeholder="Right shields" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Right shields: 0</SelectItem>
                <SelectItem value="1">Right shields: 1</SelectItem>
                <SelectItem value="2">Right shields: 2</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={20}
              max={1000}
              value={maxTurns}
              onChange={(event) => setMaxTurns(event.target.value)}
              aria-label="Max turns input"
              placeholder="Max turns"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card className={cn("transition-all duration-200", isSwapping ? "scale-[0.99] opacity-80" : "scale-100 opacity-100")}>
              <CardContent className="flex min-h-[210px] flex-col items-center justify-center gap-2.5 py-5 text-center sm:py-6 md:min-h-[232px]">
                {leftSelectedSprite ? (
                  <Image
                    src={leftSelectedSprite}
                    alt={leftSelected?.name ?? "Left Pokemon"}
                    width={92}
                    height={92}
                    unoptimized
                    className="size-16 object-contain sm:size-20 md:size-24"
                  />
                ) : (
                  <span className="bg-muted size-16 rounded-full sm:size-20 md:size-24" />
                )}
                <div className="space-y-1">
                  <CardTitle className="text-xl sm:text-2xl md:text-xl">{leftSelected?.name ?? "Left Pokemon"}</CardTitle>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {leftSelected ? <TypeBadge type={leftSelected.type1} /> : null}
                    {leftSelected?.type2 ? <TypeBadge type={leftSelected.type2} /> : null}
                  </div>
                </div>

                {leftPoolLoading ? (
                  <Skeleton className="h-16 w-full max-w-[340px]" />
                ) : (
                  <>
                    <SideProfileControls
                      sideLabel="Left"
                      ivPreset={leftIvPreset}
                      onIvPresetChange={setLeftIvPreset}
                      levelPreset={leftLevelPreset}
                      onLevelPresetChange={setLeftLevelPreset}
                      customLevel={leftCustomLevel}
                      onCustomLevelChange={setLeftCustomLevel}
                      atkIv={leftAtkIv}
                      defIv={leftDefIv}
                      hpIv={leftHpIv}
                      onAtkIvChange={setLeftAtkIv}
                      onDefIvChange={setLeftDefIv}
                      onHpIvChange={setLeftHpIv}
                      resolvedStats={leftResolvedStats}
                      validationError={leftProfileValidation.error}
                    />
                    <div className="flex w-full flex-wrap items-center justify-center gap-2">
                      <div className="w-[150px] sm:w-[160px]">
                        <Select value={leftFastId} onValueChange={setLeftFastId} disabled={leftFastMoves.length === 0}>
                          <SelectTrigger aria-label="Left fast move selector" className="w-full">
                            <SelectValue placeholder="Fast move" />
                          </SelectTrigger>
                          <SelectContent>
                            {leftFastMoves.map((move) => (
                              <SelectItem key={`left-fast-${move.id}`} value={move.id}>
                                {move.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[150px] sm:w-[160px]">
                        <Select
                          value={leftChargedId}
                          onValueChange={setLeftChargedId}
                          disabled={leftChargedMoves.length === 0}
                        >
                          <SelectTrigger aria-label="Left charged move selector" className="w-full">
                            <SelectValue placeholder="Charged move" />
                          </SelectTrigger>
                          <SelectContent>
                            {leftChargedMoves.map((move) => (
                              <SelectItem key={`left-charged-${move.id}`} value={move.id}>
                                {move.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex w-full flex-col items-center gap-1.5">
                      <div className="flex w-full flex-wrap items-center justify-center gap-1.5 text-[11px]">
                        <MoveMetaChips move={leftFastSelected} category="fast" label="Fast" />
                        <MoveMetaChips move={leftChargedSelected} category="charged" label="Charged" />
                      </div>
                      <p className="text-muted-foreground text-[10px]">1 turn = 0.5s</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className={cn("transition-all duration-200", isSwapping ? "scale-[0.99] opacity-80" : "scale-100 opacity-100")}>
              <CardContent className="flex min-h-[210px] flex-col items-center justify-center gap-2.5 py-5 text-center sm:py-6 md:min-h-[232px]">
                {rightSelectedSprite ? (
                  <Image
                    src={rightSelectedSprite}
                    alt={rightSelected?.name ?? "Right Pokemon"}
                    width={92}
                    height={92}
                    unoptimized
                    className="size-16 object-contain sm:size-20 md:size-24"
                  />
                ) : (
                  <span className="bg-muted size-16 rounded-full sm:size-20 md:size-24" />
                )}
                <div className="space-y-1">
                  <CardTitle className="text-xl sm:text-2xl md:text-xl">{rightSelected?.name ?? "Right Pokemon"}</CardTitle>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {rightSelected ? <TypeBadge type={rightSelected.type1} /> : null}
                    {rightSelected?.type2 ? <TypeBadge type={rightSelected.type2} /> : null}
                  </div>
                </div>

                {rightPoolLoading ? (
                  <Skeleton className="h-16 w-full max-w-[340px]" />
                ) : (
                  <>
                    <SideProfileControls
                      sideLabel="Right"
                      ivPreset={rightIvPreset}
                      onIvPresetChange={setRightIvPreset}
                      levelPreset={rightLevelPreset}
                      onLevelPresetChange={setRightLevelPreset}
                      customLevel={rightCustomLevel}
                      onCustomLevelChange={setRightCustomLevel}
                      atkIv={rightAtkIv}
                      defIv={rightDefIv}
                      hpIv={rightHpIv}
                      onAtkIvChange={setRightAtkIv}
                      onDefIvChange={setRightDefIv}
                      onHpIvChange={setRightHpIv}
                      resolvedStats={rightResolvedStats}
                      validationError={rightProfileValidation.error}
                    />
                    <div className="flex w-full flex-wrap items-center justify-center gap-2">
                      <div className="w-[150px] sm:w-[160px]">
                        <Select value={rightFastId} onValueChange={setRightFastId} disabled={rightFastMoves.length === 0}>
                          <SelectTrigger aria-label="Right fast move selector" className="w-full">
                            <SelectValue placeholder="Fast move" />
                          </SelectTrigger>
                          <SelectContent>
                            {rightFastMoves.map((move) => (
                              <SelectItem key={`right-fast-${move.id}`} value={move.id}>
                                {move.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-[150px] sm:w-[160px]">
                        <Select
                          value={rightChargedId}
                          onValueChange={setRightChargedId}
                          disabled={rightChargedMoves.length === 0}
                        >
                          <SelectTrigger aria-label="Right charged move selector" className="w-full">
                            <SelectValue placeholder="Charged move" />
                          </SelectTrigger>
                          <SelectContent>
                            {rightChargedMoves.map((move) => (
                              <SelectItem key={`right-charged-${move.id}`} value={move.id}>
                                {move.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex w-full flex-col items-center gap-1.5">
                      <div className="flex w-full flex-wrap items-center justify-center gap-1.5 text-[11px]">
                        <MoveMetaChips move={rightFastSelected} category="fast" label="Fast" />
                        <MoveMetaChips move={rightChargedSelected} category="charged" label="Charged" />
                      </div>
                      <p className="text-muted-foreground text-[10px]">1 turn = 0.5s</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <p className="text-muted-foreground text-xs sm:mr-2">
              Auto-runs when setup values change.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={swapSides} className="w-full sm:w-auto">
              <ArrowLeftRightIcon className="size-4" />
              Swap sides
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void runSimulation()}
              disabled={!canSimulate || resultLoading}
              className="w-full sm:w-auto"
            >
              {resultLoading ? (
                <>
                  <RefreshCwIcon className="size-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <RefreshCwIcon className="size-4" />
                  Re-run simulation
                </>
              )}
            </Button>
          </div>

          {resultError ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{resultError}</p>
          ) : null}
          {resultConfidence && resultConfidence.level !== "high" ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Confidence: {resultConfidence.level}
              </p>
              {resultConfidence.notes.length > 0 ? (
                <ul className="mt-1 space-y-0.5">
                  {resultConfidence.notes.map((note) => (
                    <li
                      key={note}
                      className="text-xs text-amber-700/90 dark:text-amber-200/90"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card data-testid="matchup-result-card">
        <CardHeader>
          <CardTitle className="text-lg">Simulation Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {resultLoading && !result ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : result ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "text-xs",
                    result.winner === "left"
                      ? "bg-emerald-600 text-white"
                      : result.winner === "right"
                        ? "bg-sky-600 text-white"
                        : "bg-muted text-foreground",
                  )}
                >
                  {result.winner === "left" && leftSelectedSprite ? (
                    <Image
                      src={leftSelectedSprite}
                      alt={leftSelected?.name ?? "Winner"}
                      width={14}
                      height={14}
                      unoptimized
                      className="mr-1 size-3.5 object-contain"
                    />
                  ) : null}
                  {result.winner === "right" && rightSelectedSprite ? (
                    <Image
                      src={rightSelectedSprite}
                      alt={rightSelected?.name ?? "Winner"}
                      width={14}
                      height={14}
                      unoptimized
                      className="mr-1 size-3.5 object-contain"
                    />
                  ) : null}
                  Winner:{" "}
                  {result.winner === "draw"
                    ? "Draw"
                    : result.winner === "left"
                      ? leftSelected?.name ?? "Left"
                      : rightSelected?.name ?? "Right"}
                </Badge>
                <Badge variant="outline">
                  <TimerIcon className="size-3.5" />
                  Turns: {result.turnsElapsed}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    result.reason === "faint"
                      ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  Reason: {result.reason === "faint" ? "Faint" : "Turn limit"}
                </Badge>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {leftSelectedSprite ? (
                      <Image
                        src={leftSelectedSprite}
                        alt={result.left.name}
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6 object-contain"
                      />
                    ) : (
                      <span className="bg-muted size-6 rounded-full" />
                    )}
                    <span>{result.left.name}</span>
                  </p>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <ShieldIcon className="size-3.5" /> Shields {result.left.shieldsRemaining}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ZapIcon className="size-3.5" /> Energy {result.left.energyRemaining}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <SwordsIcon className="size-3.5" /> HP {result.left.hpRemaining}
                    </span>
                  </div>
                  {hpSnapshot ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                        <span>HP</span>
                        <span className="tabular-nums">{result.left.hpRemaining}/{hpSnapshot.leftMax}</span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full border">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${hpSnapshot.leftPct}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-md border p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {rightSelectedSprite ? (
                      <Image
                        src={rightSelectedSprite}
                        alt={result.right.name}
                        width={24}
                        height={24}
                        unoptimized
                        className="size-6 object-contain"
                      />
                    ) : (
                      <span className="bg-muted size-6 rounded-full" />
                    )}
                    <span>{result.right.name}</span>
                  </p>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <ShieldIcon className="size-3.5" /> Shields {result.right.shieldsRemaining}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ZapIcon className="size-3.5" /> Energy {result.right.energyRemaining}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <SwordsIcon className="size-3.5" /> HP {result.right.hpRemaining}
                    </span>
                  </div>
                  {hpSnapshot ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                        <span>HP</span>
                        <span className="tabular-nums">{result.right.hpRemaining}/{hpSnapshot.rightMax}</span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full border">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${hpSnapshot.rightPct}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {matchupInsights ? (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-semibold">Matchup Insights</p>
                  {matchupInsights.keySwing ? (
                    <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-2">
                      <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Key swing</p>
                      <p className="text-muted-foreground text-xs">
                        Turn {matchupInsights.keySwing.turn}:{" "}
                        {matchupInsights.keySwing.actor === "left"
                          ? (leftSelected?.name ?? "Left")
                          : (rightSelected?.name ?? "Right")}{" "}
                        used {matchupInsights.keySwing.moveName} for{" "}
                        {matchupInsights.keySwing.damage} damage.
                      </p>
                    </div>
                  ) : null}

                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-md border p-2">
                      <p className="text-xs font-medium">{leftSelected?.name ?? "Left"} damage</p>
                      <p className="text-muted-foreground text-xs">
                        Fast {matchupInsights.leftFastDamage} | Charged {matchupInsights.leftChargedDamage} | Total{" "}
                        {matchupInsights.leftFastDamage + matchupInsights.leftChargedDamage}
                      </p>
                    </div>
                    <div className="rounded-md border p-2">
                      <p className="text-xs font-medium">{rightSelected?.name ?? "Right"} damage</p>
                      <p className="text-muted-foreground text-xs">
                        Fast {matchupInsights.rightFastDamage} | Charged {matchupInsights.rightChargedDamage} | Total{" "}
                        {matchupInsights.rightFastDamage + matchupInsights.rightChargedDamage}
                      </p>
                    </div>
                  </div>

                  {(matchupInsights.leftShieldReasons.length > 0 ||
                    matchupInsights.rightShieldReasons.length > 0) ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <p className="text-muted-foreground text-xs">
                        {leftSelected?.name ?? "Left"} shields:{" "}
                        {matchupInsights.leftShieldReasons.length > 0
                          ? matchupInsights.leftShieldReasons.join(", ")
                          : "No shield calls"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {rightSelected?.name ?? "Right"} shields:{" "}
                        {matchupInsights.rightShieldReasons.length > 0
                          ? matchupInsights.rightShieldReasons.join(", ")
                          : "No shield calls"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Configure both sides and run simulation to view matchup output.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Turn Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {explainabilityScorecard ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                CMP:{" "}
                {explainabilityScorecard.cmpWinner === "left"
                  ? `${leftSelected?.name ?? "Left"} (T${explainabilityScorecard.cmpTurn ?? "-"})`
                  : explainabilityScorecard.cmpWinner === "right"
                    ? `${rightSelected?.name ?? "Right"} (T${explainabilityScorecard.cmpTurn ?? "-"})`
                    : "No direct CMP race"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Shield Eff:{" "}
                {explainabilityScorecard.leftUsedShields === 0 &&
                explainabilityScorecard.rightUsedShields === 0
                  ? "No shields used"
                  : `${leftSelected?.name ?? "L"} ${explainabilityScorecard.leftBlocked}/${explainabilityScorecard.leftUsedShields} | ${rightSelected?.name ?? "R"} ${explainabilityScorecard.rightBlocked}/${explainabilityScorecard.rightUsedShields}`}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Charged Pressure:{" "}
                {explainabilityScorecard.chargedPressureLeader === "left"
                  ? `${leftSelected?.name ?? "Left"} ${explainabilityScorecard.leftChargedPressure}%`
                  : explainabilityScorecard.chargedPressureLeader === "right"
                    ? `${rightSelected?.name ?? "Right"} ${explainabilityScorecard.rightChargedPressure}%`
                    : `Tie ${explainabilityScorecard.leftChargedPressure}%`}
              </Badge>
            </div>
          ) : null}
          {result && result.timeline.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={timelineFilter === "all" ? "secondary" : "outline"}
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => {
                  setTimelineFilter("all");
                  setVisibleTimelineCount(TIMELINE_PREVIEW);
                }}
              >
                All ({timelineFilterCounts.all})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timelineFilter === "charged" ? "secondary" : "outline"}
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => {
                  setTimelineFilter("charged");
                  setVisibleTimelineCount(TIMELINE_PREVIEW);
                }}
              >
                Charged only ({timelineFilterCounts.charged})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timelineFilter === "shielded" ? "secondary" : "outline"}
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => {
                  setTimelineFilter("shielded");
                  setVisibleTimelineCount(TIMELINE_PREVIEW);
                }}
              >
                Shielded only ({timelineFilterCounts.shielded})
              </Button>
            </div>
          ) : null}
          {resultLoading && !result ? (
            <Skeleton className="h-36 w-full" />
          ) : result && filteredTimeline.length > 0 ? (
            <>
              <div className="space-y-2 sm:hidden">
                {timelineRows.map((event, index) => (
                  <div key={`${event.turn}-${event.actor}-${event.moveName}-${index}`} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Turn {event.turn}</span>
                      <Badge variant="outline" className={cn("h-6 rounded-full px-2 text-[10px]", getActionBadgeClass(event.action))}>
                        {event.action === "charged" ? "Charged" : "Fast"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs">
                      {event.actor === "left" ? (leftSelected?.name ?? "Left") : (rightSelected?.name ?? "Right")} used {event.moveName}
                    </p>
                    <div className="text-muted-foreground mt-1 grid grid-cols-3 gap-1 text-[11px]">
                      <span>Dmg {event.damage}</span>
                      <span>
                        Shield{" "}
                        {event.shielded
                          ? `Yes${event.shieldReason ? ` (${formatShieldReason(event.shieldReason) ?? ""})` : ""}`
                          : "No"}
                      </span>
                      <span className="text-right">HP {event.targetHpAfter}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-md border sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px]">Turn</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Move</TableHead>
                      <TableHead className="text-right">Dmg</TableHead>
                      <TableHead>Shield</TableHead>
                      <TableHead className="text-right">Target HP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timelineRows.map((event, index) => (
                      <TableRow key={`${event.turn}-${event.actor}-${event.moveName}-${index}`}>
                        <TableCell className="tabular-nums">{event.turn}</TableCell>
                        <TableCell>{event.actor === "left" ? (leftSelected?.name ?? "Left") : (rightSelected?.name ?? "Right")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("h-6 rounded-full px-2 text-[10px]", getActionBadgeClass(event.action))}>
                            {event.action === "charged" ? "Charged" : "Fast"}
                          </Badge>
                        </TableCell>
                        <TableCell>{event.moveName}</TableCell>
                        <TableCell className="text-right tabular-nums">{event.damage}</TableCell>
                        <TableCell>
                          {event.shielded
                            ? `Yes${event.shieldReason ? ` (${formatShieldReason(event.shieldReason) ?? ""})` : ""}`
                            : "No"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{event.targetHpAfter}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredTimeline.length > TIMELINE_PREVIEW ? (
                <div className="flex flex-wrap items-center gap-2">
                  {hiddenTimelineCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setVisibleTimelineCount((current) =>
                          Math.min(filteredTimeline.length, current + TIMELINE_PAGE_SIZE),
                        )
                      }
                    >
                      Show next {Math.min(TIMELINE_PAGE_SIZE, hiddenTimelineCount)} ({hiddenTimelineCount} left)
                    </Button>
                  ) : null}
                  {hiddenTimelineCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleTimelineCount(filteredTimeline.length)}
                    >
                      Show all
                    </Button>
                  ) : null}
                  {visibleTimelineCount > TIMELINE_PREVIEW ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleTimelineCount(TIMELINE_PREVIEW)}
                    >
                      Show less
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : result && result.timeline.length > 0 ? (
            <p className="text-muted-foreground text-sm">No events for this filter.</p>
          ) : (
            <p className="text-muted-foreground text-sm">No timeline yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
