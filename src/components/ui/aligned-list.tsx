import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AlignedListProps {
  children: ReactNode;
  className?: string;
}

interface AlignedListRowProps {
  avatar: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  tag?: ReactNode;
  metric?: ReactNode;
  date?: ReactNode;
  action?: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  disableHover?: boolean;
}

export function AlignedList({ children, className }: AlignedListProps) {
  return <div className={cn("aligned-list", className)}>{children}</div>;
}

export function AlignedListRow({
  avatar,
  primary,
  secondary,
  tag,
  metric,
  date,
  action,
  className,
  onClick,
  ariaLabel,
  disableHover = false,
}: AlignedListRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onClick();
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button, a")) return;
    onClick?.();
  };

  return (
    <div
      className={cn("aligned-list-row", onClick && "aligned-list-row-selectable", disableHover && "aligned-list-row-no-hover", className)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="aligned-list-cell aligned-list-avatar">{avatar}</span>
      <span className="aligned-list-cell aligned-list-copy">
        <span className="aligned-list-primary">{primary}</span>
        <span className="aligned-list-secondary">{secondary || ""}</span>
      </span>
      <span className="aligned-list-cell aligned-list-tag">{tag || ""}</span>
      <span className="aligned-list-cell aligned-list-metric">{metric || ""}</span>
      <span className="aligned-list-cell aligned-list-date">{date || ""}</span>
      <span className="aligned-list-cell aligned-list-action">{action || ""}</span>
    </div>
  );
}
