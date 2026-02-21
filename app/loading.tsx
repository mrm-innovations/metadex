import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-3">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="mt-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </main>
  );
}
