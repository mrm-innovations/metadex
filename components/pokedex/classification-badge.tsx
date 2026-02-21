import { Pill } from "@/components/pokedex/pill";
import type { PokemonClassification } from "@/lib/pokeapi";

export function ClassificationBadge({
  classification,
}: {
  classification: PokemonClassification;
}) {
  if (!classification) {
    return null;
  }

  if (classification === "Mythical") {
    return <Pill className="bg-fuchsia-500/90 text-white">Mythical</Pill>;
  }

  return <Pill className="bg-amber-400/90 text-amber-950">Legendary</Pill>;
}
