"use client";

import { Button } from "@/components/ui/button";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Showing {start}-{end} of {totalCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <p className="text-sm">
          Page {page} / {Math.max(totalPages, 1)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
