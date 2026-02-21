"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { RemovablePill } from "@/components/pokedex/pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  collectTypes,
  POKEDEX_SORT_OPTIONS,
  sortPokemonRows,
  type PokedexSortKey,
} from "@/lib/pokedex";
import type { PokemonRow } from "@/lib/normalize";
import type { PokemonClassification } from "@/lib/pokeapi";

import {
  CLASSIFICATION_FILTER_OPTIONS,
  FiltersBar,
  type ClassificationFilter,
} from "@/components/pokedex/filters-bar";
import { PaginationControls } from "@/components/pokedex/pagination-controls";
import { PokedexTable } from "@/components/pokedex/pokedex-table";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const CLASSIFICATION_BATCH_SIZE = 60;
const SEARCH_DEBOUNCE_MS = 250;
const DEFAULT_SORT: PokedexSortKey = "nat";
const DEFAULT_CLASSIFICATION_FILTER: ClassificationFilter = "all";

type UrlState = {
  search: string;
  types: string[];
  classification: ClassificationFilter;
  sortBy: PokedexSortKey;
  page: number;
};

const VALID_SORTS = new Set<PokedexSortKey>([
  "name",
  "nat",
  "pogoAtk",
  "pogoDef",
  "pogoHp",
]);

function normalizeTypes(types: string[]): string[] {
  return [...new Set(types.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function parseUrlState(searchParams: { get: (key: string) => string | null }): UrlState {
  const search = (searchParams.get("search") ?? "").trim();
  const rawTypes = searchParams.get("types");
  const types = normalizeTypes((rawTypes ?? "").split(",").map((item) => item.trim()));
  const rawClassification = searchParams.get("classification");
  const classification = CLASSIFICATION_FILTER_OPTIONS.some((option) => option.value === rawClassification)
    ? (rawClassification as ClassificationFilter)
    : DEFAULT_CLASSIFICATION_FILTER;
  const rawSort = searchParams.get("sort");
  const sortBy = rawSort && VALID_SORTS.has(rawSort as PokedexSortKey) ? (rawSort as PokedexSortKey) : DEFAULT_SORT;
  const rawPage = Number.parseInt(searchParams.get("page") ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  return { search, types, classification, sortBy, page };
}

function getClassificationFilterLabel(value: ClassificationFilter): string {
  const match = CLASSIFICATION_FILTER_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
}

export function PokedexBrowser({
  rows,
  initialClassificationByNat,
}: {
  rows: PokemonRow[];
  initialClassificationByNat?: Record<string, PokemonClassification | null>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialUrlState = useMemo(() => parseUrlState(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(initialUrlState.search);
  const [searchTerm, setSearchTerm] = useState(initialUrlState.search);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialUrlState.types);
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>(initialUrlState.classification);
  const [sortBy, setSortBy] = useState<PokedexSortKey>(initialUrlState.sortBy);
  const [page, setPage] = useState(initialUrlState.page);
  const [isScrolled, setIsScrolled] = useState(false);
  const [classificationByNat, setClassificationByNat] = useState<Record<string, PokemonClassification | null>>(
    initialClassificationByNat ?? {},
  );

  const allTypes = useMemo(() => collectTypes(rows), [rows]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredAndSortedRows = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (search && !row.name.toLowerCase().includes(search)) {
        return false;
      }

      if (selectedTypes.length > 0) {
        const rowTypes = [row.type1, row.type2].filter(Boolean);
        const matchesType = selectedTypes.some((selectedType) => rowTypes.includes(selectedType));
        if (!matchesType) {
          return false;
        }
      }

      return true;
    });

    return sortPokemonRows(filtered, sortBy);
  }, [rows, searchTerm, selectedTypes, sortBy]);

  const filteredRows = useMemo(() => {
    if (classificationFilter === "all") {
      return filteredAndSortedRows;
    }

    const targetClassification: PokemonClassification =
      classificationFilter === "legendary" ? "Legendary" : "Mythical";

    return filteredAndSortedRows.filter((row) => classificationByNat[row.nat] === targetClassification);
  }, [classificationByNat, classificationFilter, filteredAndSortedRows]);

  const sortLabel = useMemo(() => {
    const match = POKEDEX_SORT_OPTIONS.find((option) => option.value === sortBy);
    return match?.label ?? sortBy;
  }, [sortBy]);

  const hasActiveFilters =
    Boolean(searchTerm) ||
    selectedTypes.length > 0 ||
    classificationFilter !== DEFAULT_CLASSIFICATION_FILTER ||
    sortBy !== DEFAULT_SORT;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pagedRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE);

  const classificationTargetNats = useMemo(() => {
    const sourceRows = classificationFilter === "all" ? pagedRows : filteredAndSortedRows;
    return [...new Set(sourceRows.map((row) => row.nat))];
  }, [classificationFilter, filteredAndSortedRows, pagedRows]);

  const isClassificationLoading =
    classificationFilter !== "all" &&
    classificationTargetNats.some((nat) => !(nat in classificationByNat));

  useEffect(() => {
    const missingNats = classificationTargetNats.filter((nat) => !(nat in classificationByNat));
    if (missingNats.length === 0) {
      return;
    }

    const controller = new AbortController();
    const chunks: string[][] = [];
    for (let i = 0; i < missingNats.length; i += CLASSIFICATION_BATCH_SIZE) {
      chunks.push(missingNats.slice(i, i + CLASSIFICATION_BATCH_SIZE));
    }

    void (async () => {
      const merged: Record<string, PokemonClassification | null> = {};
      for (const chunk of chunks) {
        const query = encodeURIComponent(chunk.join(","));
        const response = await fetch(`/api/classification?nats=${query}`, { signal: controller.signal });
        if (!response.ok) {
          continue;
        }

        const json = (await response.json()) as {
          data?: Record<string, PokemonClassification | null>;
        };

        if (json.data) {
          Object.assign(merged, json.data);
        }
      }

      if (Object.keys(merged).length > 0) {
        setClassificationByNat((current) => ({
          ...current,
          ...merged,
        }));
      }
    })()
      .catch(() => {
        // no-op: classifications are optional decorations
      });

    return () => controller.abort();
  }, [classificationByNat, classificationTargetNats]);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 4);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const normalizedTypes = normalizeTypes(selectedTypes);
    const current = parseUrlState(searchParams);
    const isSameState =
      current.search === searchTerm &&
      current.classification === classificationFilter &&
      current.sortBy === sortBy &&
      current.page === safePage &&
      arraysEqual(current.types, normalizedTypes);

    if (isSameState) {
      return;
    }

    const nextParams = new URLSearchParams();
    if (searchTerm) {
      nextParams.set("search", searchTerm);
    }
    if (normalizedTypes.length > 0) {
      nextParams.set("types", normalizedTypes.join(","));
    }
    if (classificationFilter !== DEFAULT_CLASSIFICATION_FILTER) {
      nextParams.set("classification", classificationFilter);
    }
    if (sortBy !== DEFAULT_SORT) {
      nextParams.set("sort", sortBy);
    }
    if (safePage > 1) {
      nextParams.set("page", String(safePage));
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [classificationFilter, pathname, safePage, router, searchParams, searchTerm, selectedTypes, sortBy]);

  const resetPage = () => setPage(1);

  const resetAllFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setSelectedTypes([]);
    setClassificationFilter(DEFAULT_CLASSIFICATION_FILTER);
    setSortBy(DEFAULT_SORT);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "bg-background/95 supports-[backdrop-filter]:bg-background/80 relative sticky top-0 z-10 -mx-4 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-0 left-1/2 w-screen -translate-x-1/2 border-b transition-opacity duration-200",
            isScrolled ? "opacity-100" : "opacity-0",
          )}
        />
        <FiltersBar
          searchTerm={searchInput}
          onSearchChange={(value) => {
            setSearchInput(value);
            resetPage();
          }}
          selectedTypes={selectedTypes}
          allTypes={allTypes}
          onToggleType={(type) => {
            setSelectedTypes((current) => {
              const exists = current.includes(type);
              const next = exists ? current.filter((item) => item !== type) : [...current, type];
              return normalizeTypes(next);
            });
            resetPage();
          }}
          onClearTypes={() => {
            setSelectedTypes([]);
            resetPage();
          }}
          classificationFilter={classificationFilter}
          onClassificationChange={(value) => {
            setClassificationFilter(value);
            resetPage();
          }}
          sortBy={sortBy}
          onSortChange={(nextSort) => {
            setSortBy(nextSort);
            resetPage();
          }}
          onReset={resetAllFilters}
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
          Results: {filteredRows.length} / {rows.length}
        </p>
        <p className="text-muted-foreground hidden sm:block" role="status" aria-live="polite" aria-atomic="true">
          {classificationFilter !== "all" && isClassificationLoading
            ? "Resolving classifications..."
            : "Client-side filtering and sorting"}
        </p>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted-foreground text-xs">Active filters:</p>
          {searchTerm ? (
            <RemovablePill
              label={`Search: ${searchTerm}`}
              truncate
              onRemove={() => {
                setSearchInput("");
                setSearchTerm("");
                resetPage();
              }}
              ariaLabel="Remove search filter"
            />
          ) : null}

          {selectedTypes.map((type) => (
            <RemovablePill
              key={type}
              label={`Type: ${type}`}
              onRemove={() => {
                setSelectedTypes((current) => normalizeTypes(current.filter((item) => item !== type)));
                resetPage();
              }}
              ariaLabel={`Remove ${type} type filter`}
            />
          ))}

          {classificationFilter !== DEFAULT_CLASSIFICATION_FILTER ? (
            <RemovablePill
              label={getClassificationFilterLabel(classificationFilter)}
              onRemove={() => {
                setClassificationFilter(DEFAULT_CLASSIFICATION_FILTER);
                resetPage();
              }}
              ariaLabel="Remove classification filter"
            />
          ) : null}

          {sortBy !== DEFAULT_SORT ? (
            <RemovablePill
              label={`Sort: ${sortLabel}`}
              onRemove={() => {
                setSortBy(DEFAULT_SORT);
                resetPage();
              }}
              ariaLabel="Reset sort filter"
            />
          ) : null}

          <Button size="sm" variant="ghost" onClick={resetAllFilters}>
            Clear all
          </Button>
        </div>
      ) : null}

      {pagedRows.length > 0 ? (
        <>
          <PokedexTable rows={pagedRows} classificationByNat={classificationByNat} />
          <PaginationControls
            page={safePage}
            totalPages={totalPages}
            totalCount={filteredRows.length}
            pageSize={PAGE_SIZE}
            onPageChange={(nextPage) => setPage(Math.min(Math.max(nextPage, 1), totalPages))}
          />
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No Pokemon match your current filters.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
