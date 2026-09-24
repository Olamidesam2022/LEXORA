import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppTableShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppTableShell({ children, className }: AppTableShellProps) {
  return (
    <div className={cn("app-table-shell", className)}>
      <div className="app-table-scroll">{children}</div>
    </div>
  );
}

interface AppTablePaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function AppTablePagination({
  page,
  pageCount,
  total,
  onPageChange,
}: AppTablePaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div className="app-table-pagination">
      <span className="text-sm font-medium text-muted-foreground">
        Page {page} of {pageCount} - {total} records
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="icon-button h-9 w-9"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="icon-button h-9 w-9"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
