import Image from "next/image";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, GitBranchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEvolutionChainForNat, type EvolutionNode } from "@/lib/pokeapi";
import { getDualTypeHeroTheme } from "@/lib/type-theme";
import { cn } from "@/lib/utils";

function parseSpeciesNat(nat: string): number | null {
  const parsed = Number.parseFloat(nat.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizePokemonName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCurrentNode(
  node: EvolutionNode,
  currentSpeciesNat: number | null,
  currentPokemonName?: string,
): boolean {
  const isCurrentByNat =
    node.nat !== null && currentSpeciesNat !== null && node.nat === currentSpeciesNat;
  const isCurrentByName =
    !!currentPokemonName &&
    normalizePokemonName(node.name) === normalizePokemonName(currentPokemonName);

  return isCurrentByNat || isCurrentByName;
}

function getStageLabel(depth: number): string {
  if (depth <= 0) {
    return "Base";
  }
  return `Stage ${depth}`;
}

function chainHasBranch(node: EvolutionNode): boolean {
  if (node.children.length > 1) {
    return true;
  }

  return node.children.some(chainHasBranch);
}

function findPathToCurrent(
  node: EvolutionNode,
  currentSpeciesNat: number | null,
  currentPokemonName?: string,
): EvolutionNode[] | null {
  if (isCurrentNode(node, currentSpeciesNat, currentPokemonName)) {
    return [node];
  }

  for (const child of node.children) {
    const childPath = findPathToCurrent(child, currentSpeciesNat, currentPokemonName);
    if (childPath) {
      return [node, ...childPath];
    }
  }

  return null;
}

function collectFallbackPath(root: EvolutionNode): EvolutionNode[] {
  const path: EvolutionNode[] = [root];
  let current = root;

  while (current.children.length > 0) {
    current = current.children[0];
    path.push(current);
  }

  return path;
}

function collectLinearPath(
  root: EvolutionNode,
  currentSpeciesNat: number | null,
  currentPokemonName?: string,
): EvolutionNode[] {
  const currentPath = findPathToCurrent(root, currentSpeciesNat, currentPokemonName);
  const path = currentPath && currentPath.length > 0 ? [...currentPath] : collectFallbackPath(root);

  // If current form has a single downstream evolution, include it for continuity.
  let tail = path[path.length - 1];
  while (tail.children.length === 1) {
    tail = tail.children[0];
    path.push(tail);
  }

  return path;
}

function EvolutionStepCard({
  node,
  stage,
  isCurrent,
  currentNodeHighlightClass,
}: {
  node: EvolutionNode;
  stage: number;
  isCurrent: boolean;
  currentNodeHighlightClass?: string;
}) {
  const content = (
    <article
      data-current={isCurrent ? "true" : "false"}
      className={cn(
        "group flex min-h-[96px] w-full items-center gap-3 rounded-xl border p-3 transition-colors sm:min-w-[240px] sm:w-auto",
        "snap-start",
        "hover:border-primary/40",
        isCurrent ? currentNodeHighlightClass ?? "border-primary bg-primary/10" : "bg-card",
      )}
    >
      {node.spriteUrl ? (
        <Image
          src={node.spriteUrl}
          alt={node.displayName}
          width={56}
          height={56}
          unoptimized
          className="size-14 shrink-0 object-contain"
        />
      ) : (
        <div className="bg-muted size-14 shrink-0 rounded-md" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold leading-tight">{node.displayName}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">#{node.nat ?? "?"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {getStageLabel(stage)}
          </Badge>
          {isCurrent ? <Badge data-testid="evo-current-badge">Current</Badge> : null}
        </div>
      </div>

      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </article>
  );

  if (node.nat) {
    return (
      <Link
        href={`/pokemon/${encodeURIComponent(String(node.nat))}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
        aria-label={`${node.displayName} #${node.nat}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}

export function EvolutionSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Evolution Chain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}

async function loadEvolutionData(nat: string) {
  try {
    const chain = await getEvolutionChainForNat(nat);
    return { chain, error: null as string | null };
  } catch (error) {
    return {
      chain: null,
      error: error instanceof Error ? error.message : "Failed to load evolution chain.",
    };
  }
}

export async function EvolutionSection({
  nat,
  currentName,
  currentType1,
  currentType2,
}: {
  nat: string;
  currentName?: string;
  currentType1?: string;
  currentType2?: string;
}) {
  const currentSpeciesNat = parseSpeciesNat(nat);
  const { chain, error } = await loadEvolutionData(nat);
  const currentTypeTheme = getDualTypeHeroTheme(currentType1, currentType2);
  const currentNodeHighlightClass = cn(
    currentTypeTheme.surfaceClass,
    currentTypeTheme.borderClass,
  );

  if (!chain) {
    return (
      <Card data-testid="evolution-section">
        <CardHeader>
          <CardTitle className="text-lg">Evolution Chain</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{error ?? "Failed to load evolution chain."}</p>
        </CardContent>
      </Card>
    );
  }

  const path = collectLinearPath(chain.root, currentSpeciesNat, currentName);
  const hasBranch = chainHasBranch(chain.root);

  return (
    <Card data-testid="evolution-section">
      <CardHeader>
        <CardTitle className="text-lg">Evolution Chain</CardTitle>
        <p className="text-muted-foreground text-sm">
          Simplified stage flow. Select a stage card to open that Pokemon.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2.5 sm:hidden">
          {path.map((node, index) => (
            <div key={`${node.name}-${node.nat ?? "x"}`} className="space-y-2.5">
              <EvolutionStepCard
                node={node}
                stage={index}
                isCurrent={isCurrentNode(node, currentSpeciesNat, currentName)}
                currentNodeHighlightClass={currentNodeHighlightClass}
              />
              {index < path.length - 1 ? (
                <div className="text-muted-foreground flex justify-center">
                  <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-md border">
                    <ChevronDownIcon className="size-4" />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto pb-1 sm:block">
          <div className="flex min-w-max snap-x snap-mandatory items-center gap-2.5">
            {path.map((node, index) => (
              <div key={`${node.name}-${node.nat ?? "x"}`} className="flex items-center gap-2.5">
                <EvolutionStepCard
                  node={node}
                  stage={index}
                  isCurrent={isCurrentNode(node, currentSpeciesNat, currentName)}
                  currentNodeHighlightClass={currentNodeHighlightClass}
                />
                {index < path.length - 1 ? (
                  <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md border">
                    <ChevronRightIcon className="size-4" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {hasBranch ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <GitBranchIcon className="size-3.5" />
            Branched family detected. Showing the main route for this Pokemon.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
