import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  to?: string;
  compact?: boolean;
  inverse?: boolean;
  className?: string;
}

export function BrandLogo({ to, compact = false, inverse = false, className }: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <svg className="h-10 w-10 shrink-0" viewBox="0 0 48 48" role="img" aria-label="">
        <rect width="48" height="48" rx="15" fill="#153D32" />
        <path d="M14 12v24h12" fill="none" stroke="#F6F4ED" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m27 13 10 22M37 13 27 35" fill="none" stroke="#B7D5A6" strokeWidth="4" strokeLinecap="round" />
        <circle cx="14" cy="12" r="2" fill="#B7D5A6" />
      </svg>
      {!compact && (
        <span className="min-w-0">
          <span className={cn("block text-[15px] font-extrabold leading-tight tracking-[0.12em]", inverse ? "text-sidebar-foreground" : "text-foreground")}>
            LEXORA
          </span>
          <span className={cn("mt-0.5 block text-[9px] font-bold uppercase leading-tight tracking-[0.16em]", inverse ? "text-sidebar-foreground/65" : "text-muted-foreground")}>
            Legal workspace
          </span>
        </span>
      )}
    </span>
  );

  if (!to) return content;

  return (
    <Link to={to} className="inline-flex min-h-11 items-center">
      {content}
    </Link>
  );
}
