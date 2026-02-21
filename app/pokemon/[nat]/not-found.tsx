import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PokemonNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Pokemon not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            The selected Pokemon nat ID does not exist in the current Google Sheet dataset.
          </p>
          <Button asChild>
            <Link href="/">Return to MetaDex</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
