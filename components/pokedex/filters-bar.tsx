"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { RemovablePill } from "@/components/pokedex/pill";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { POKEDEX_SORT_OPTIONS, type PokedexSortKey } from "@/lib/pokedex";
import { cn } from "@/lib/utils";

export const CLASSIFICATION_FILTER_OPTIONS = [
  { value: "all", label: "All classifications" },
  { value: "legendary", label: "Legendary" },
  { value: "mythical", label: "Mythical" },
] as const;

export type ClassificationFilter = (typeof CLASSIFICATION_FILTER_OPTIONS)[number]["value"];

type FiltersBarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedTypes: string[];
  allTypes: string[];
  onToggleType: (type: string) => void;
  onClearTypes: () => void;
  classificationFilter: ClassificationFilter;
  onClassificationChange: (value: ClassificationFilter) => void;
  sortBy: PokedexSortKey;
  onSortChange: (sort: PokedexSortKey) => void;
  onReset: () => void;
};

export function FiltersBar({
  searchTerm,
  onSearchChange,
  selectedTypes,
  allTypes,
  onToggleType,
  onClearTypes,
  classificationFilter,
  onClassificationChange,
  sortBy,
  onSortChange,
  onReset,
}: FiltersBarProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search Pokemon by name..."
          aria-label="Search Pokemon by name"
          className="bg-background"
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between"
            >
              {selectedTypes.length > 0 ? `Types (${selectedTypes.length})` : "Filter Types"}
              <ChevronsUpDownIcon className="size-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
            <Command>
              <CommandInput placeholder="Search types..." />
              <CommandList>
                <CommandEmpty>No matching type.</CommandEmpty>
                <CommandGroup>
                  {allTypes.map((type) => {
                    const selected = selectedTypes.includes(type);
                    return (
                      <CommandItem key={type} value={type} onSelect={() => onToggleType(type)}>
                        <CheckIcon className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                        {type}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Select value={classificationFilter} onValueChange={(value) => onClassificationChange(value as ClassificationFilter)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICATION_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => onSortChange(value as PokedexSortKey)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {POKEDEX_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>

      {selectedTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selectedTypes.map((type) => (
            <RemovablePill
              key={type}
              label={type}
              onRemove={() => onToggleType(type)}
              ariaLabel={`Remove ${type} filter`}
            />
          ))}
          <Button size="sm" variant="ghost" onClick={onClearTypes}>
            Clear types
          </Button>
        </div>
      ) : null}
    </div>
  );
}
