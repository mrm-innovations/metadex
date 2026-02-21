export type TypeTheme = {
  pillClass: string;
  heroFromClass: string;
  heroToClass: string;
  heroSolidClass: string;
  heroBorderClass: string;
  accentClass: string;
  statBarClass: string;
};

const DEFAULT_TYPE_THEME: TypeTheme = {
  pillClass: "bg-muted text-foreground",
  heroFromClass: "from-muted/50",
  heroToClass: "to-muted/20",
  heroSolidClass: "bg-muted/50 dark:bg-muted/40",
  heroBorderClass: "border-border",
  accentClass: "text-foreground",
  statBarClass: "bg-primary",
};

const TYPE_THEMES: Record<string, TypeTheme> = {
  normal: {
    pillClass: "bg-stone-200 text-stone-900",
    heroFromClass: "from-stone-400/14",
    heroToClass: "to-stone-200/12",
    heroSolidClass: "bg-stone-300/30 dark:bg-stone-600/30",
    heroBorderClass: "border-stone-400/28",
    accentClass: "text-stone-700",
    statBarClass: "bg-stone-500 dark:bg-stone-400",
  },
  fire: {
    pillClass: "bg-orange-300 text-orange-950",
    heroFromClass: "from-orange-500/16",
    heroToClass: "to-red-400/14",
    heroSolidClass: "bg-orange-300/35 dark:bg-orange-600/35",
    heroBorderClass: "border-orange-500/28",
    accentClass: "text-orange-700",
    statBarClass: "bg-orange-500 dark:bg-orange-400",
  },
  water: {
    pillClass: "bg-blue-300 text-blue-950",
    heroFromClass: "from-blue-500/16",
    heroToClass: "to-cyan-400/14",
    heroSolidClass: "bg-blue-300/34 dark:bg-blue-600/34",
    heroBorderClass: "border-blue-500/28",
    accentClass: "text-blue-700",
    statBarClass: "bg-blue-500 dark:bg-blue-400",
  },
  electric: {
    pillClass: "bg-yellow-300 text-yellow-950",
    heroFromClass: "from-amber-400/16",
    heroToClass: "to-yellow-300/14",
    heroSolidClass: "bg-amber-300/38 dark:bg-amber-600/36",
    heroBorderClass: "border-amber-400/30",
    accentClass: "text-amber-700",
    statBarClass: "bg-amber-500 dark:bg-amber-400",
  },
  grass: {
    pillClass: "bg-green-300 text-green-950",
    heroFromClass: "from-emerald-500/16",
    heroToClass: "to-lime-400/14",
    heroSolidClass: "bg-emerald-300/35 dark:bg-emerald-700/32",
    heroBorderClass: "border-emerald-500/28",
    accentClass: "text-emerald-700",
    statBarClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  ice: {
    pillClass: "bg-cyan-200 text-cyan-950",
    heroFromClass: "from-cyan-400/16",
    heroToClass: "to-sky-300/14",
    heroSolidClass: "bg-cyan-200/42 dark:bg-cyan-700/30",
    heroBorderClass: "border-cyan-400/28",
    accentClass: "text-cyan-700",
    statBarClass: "bg-cyan-500 dark:bg-cyan-400",
  },
  fighting: {
    pillClass: "bg-red-300 text-red-950",
    heroFromClass: "from-red-500/16",
    heroToClass: "to-rose-400/14",
    heroSolidClass: "bg-red-300/35 dark:bg-red-700/34",
    heroBorderClass: "border-red-500/28",
    accentClass: "text-red-700",
    statBarClass: "bg-red-500 dark:bg-red-400",
  },
  poison: {
    pillClass: "bg-violet-300 text-violet-950",
    heroFromClass: "from-violet-500/16",
    heroToClass: "to-fuchsia-400/14",
    heroSolidClass: "bg-violet-300/34 dark:bg-violet-700/34",
    heroBorderClass: "border-violet-500/28",
    accentClass: "text-violet-700",
    statBarClass: "bg-violet-500 dark:bg-violet-400",
  },
  ground: {
    pillClass: "bg-amber-300 text-amber-950",
    heroFromClass: "from-amber-500/16",
    heroToClass: "to-yellow-400/14",
    heroSolidClass: "bg-amber-300/36 dark:bg-amber-700/33",
    heroBorderClass: "border-amber-500/30",
    accentClass: "text-amber-700",
    statBarClass: "bg-amber-600 dark:bg-amber-500",
  },
  flying: {
    pillClass: "bg-sky-200 text-sky-950",
    heroFromClass: "from-sky-400/16",
    heroToClass: "to-indigo-300/14",
    heroSolidClass: "bg-sky-200/42 dark:bg-sky-700/30",
    heroBorderClass: "border-sky-400/28",
    accentClass: "text-sky-700",
    statBarClass: "bg-sky-500 dark:bg-sky-400",
  },
  psychic: {
    pillClass: "bg-pink-300 text-pink-950",
    heroFromClass: "from-pink-500/16",
    heroToClass: "to-fuchsia-400/14",
    heroSolidClass: "bg-pink-300/35 dark:bg-pink-700/32",
    heroBorderClass: "border-pink-500/28",
    accentClass: "text-pink-700",
    statBarClass: "bg-pink-500 dark:bg-pink-400",
  },
  bug: {
    pillClass: "bg-lime-300 text-lime-950",
    heroFromClass: "from-lime-500/16",
    heroToClass: "to-green-400/14",
    heroSolidClass: "bg-lime-300/37 dark:bg-lime-700/32",
    heroBorderClass: "border-lime-500/28",
    accentClass: "text-lime-700",
    statBarClass: "bg-lime-500 dark:bg-lime-400",
  },
  rock: {
    pillClass: "bg-yellow-500 text-yellow-950",
    heroFromClass: "from-yellow-600/16",
    heroToClass: "to-amber-500/14",
    heroSolidClass: "bg-yellow-300/38 dark:bg-yellow-700/33",
    heroBorderClass: "border-yellow-600/30",
    accentClass: "text-yellow-700",
    statBarClass: "bg-yellow-600 dark:bg-yellow-500",
  },
  ghost: {
    pillClass: "bg-indigo-300 text-indigo-950",
    heroFromClass: "from-indigo-500/16",
    heroToClass: "to-violet-400/14",
    heroSolidClass: "bg-indigo-300/35 dark:bg-indigo-700/34",
    heroBorderClass: "border-indigo-500/28",
    accentClass: "text-indigo-700",
    statBarClass: "bg-indigo-500 dark:bg-indigo-400",
  },
  dragon: {
    pillClass: "bg-purple-300 text-purple-950",
    heroFromClass: "from-purple-500/16",
    heroToClass: "to-indigo-500/14",
    heroSolidClass: "bg-purple-300/35 dark:bg-purple-700/33",
    heroBorderClass: "border-purple-500/28",
    accentClass: "text-purple-700",
    statBarClass: "bg-purple-500 dark:bg-purple-400",
  },
  dark: {
    pillClass: "bg-zinc-300 text-zinc-950",
    heroFromClass: "from-zinc-500/16",
    heroToClass: "to-slate-500/14",
    heroSolidClass: "bg-zinc-300/34 dark:bg-zinc-700/36",
    heroBorderClass: "border-zinc-500/28",
    accentClass: "text-zinc-700",
    statBarClass: "bg-zinc-500 dark:bg-zinc-400",
  },
  steel: {
    pillClass: "bg-slate-300 text-slate-950",
    heroFromClass: "from-slate-500/16",
    heroToClass: "to-zinc-400/14",
    heroSolidClass: "bg-slate-300/36 dark:bg-slate-700/35",
    heroBorderClass: "border-slate-500/28",
    accentClass: "text-slate-700",
    statBarClass: "bg-slate-500 dark:bg-slate-400",
  },
  fairy: {
    pillClass: "bg-rose-200 text-rose-950",
    heroFromClass: "from-rose-400/16",
    heroToClass: "to-pink-300/14",
    heroSolidClass: "bg-rose-200/45 dark:bg-rose-700/32",
    heroBorderClass: "border-rose-400/28",
    accentClass: "text-rose-700",
    statBarClass: "bg-rose-500 dark:bg-rose-400",
  },
};

function normalizePokemonType(type?: string): string {
  return (type ?? "").trim().toLowerCase();
}

export function getTypeTheme(type?: string): TypeTheme {
  const normalized = normalizePokemonType(type);
  return TYPE_THEMES[normalized] ?? DEFAULT_TYPE_THEME;
}

export function getDualTypeHeroTheme(type1?: string, type2?: string): {
  gradientClass: string;
  surfaceClass: string;
  borderClass: string;
  accentClass: string;
} {
  const primary = getTypeTheme(type1);
  const secondary = type2 ? getTypeTheme(type2) : primary;

  return {
    gradientClass: `${primary.heroFromClass} via-background ${secondary.heroToClass}`,
    surfaceClass: primary.heroSolidClass,
    borderClass: primary.heroBorderClass,
    // Force readable accent text in dark surfaces while preserving type tint in light mode.
    accentClass: `${primary.accentClass} dark:text-foreground`,
  };
}
