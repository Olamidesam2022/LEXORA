import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'accent' | 'warning' | 'success';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = 'default',
  className 
}: MetricCardProps) {
  const iconStyles = {
    default: 'bg-primary text-primary-foreground',
    accent: 'bg-primary text-primary-foreground',
    warning: 'bg-warning text-warning-foreground',
    success: 'bg-success text-success-foreground',
  };

  return (
    <div className={cn("metric-card animate-fade-in", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">{title}</p>
          <div className="mt-2 flex items-baseline gap-2 flex-wrap">
            <p className="text-2xl sm:text-3xl font-extrabold text-foreground">{value}</p>
            {trend && (
              <span className={cn(
                "rounded-md px-1.5 py-0.5 text-xs font-bold",
                trend.isPositive ? "text-success" : "text-destructive"
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs sm:text-sm font-medium text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5 shadow-sm flex-shrink-0", iconStyles[variant])}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </div>
  );
}
