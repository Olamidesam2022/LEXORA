import { cn } from "@/lib/utils";

const statusSteps = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In Progress" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed" },
] as const;

const statusIndex: Record<string, number> = {
  open: 0,
  active: 0,
  urgent: 0,
  in_progress: 1,
  "in progress": 1,
  pending: 2,
  pending_response: 2,
  "pending response": 2,
  closed: 3,
  completed: 3,
  archived: 3,
};

interface StatusProgressBarProps {
  status?: string | null;
}

export function StatusProgressBar({ status }: StatusProgressBarProps) {
  const currentIndex = statusIndex[(status || "open").toLowerCase()] ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        {statusSteps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex flex-1 items-center last:flex-none">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  isComplete && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-accent bg-accent text-accent-foreground",
                  !isComplete && !isCurrent && "border-muted bg-background text-muted-foreground",
                )}
              >
                {index + 1}
              </div>
              {index < statusSteps.length - 1 && (
                <div
                  className={cn(
                    "h-1 flex-1 transition-colors",
                    index < currentIndex ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
        {statusSteps.map((step, index) => (
          <span
            key={step.key}
            className={cn(index === currentIndex && "text-accent-foreground")}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}
