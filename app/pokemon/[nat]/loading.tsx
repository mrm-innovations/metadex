import { Skeleton } from "@/components/ui/skeleton";

export default function PokemonDetailLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <Skeleton className="h-[220px] w-full" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
