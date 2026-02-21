import { Pill } from "@/components/pokedex/pill";
import { getTypeTheme } from "@/lib/type-theme";
import { cn } from "@/lib/utils";

export function TypeBadge({ type }: { type: string }) {
  const theme = getTypeTheme(type);

  return (
    <Pill className={cn(theme.pillClass)}>
      {type}
    </Pill>
  );
}
