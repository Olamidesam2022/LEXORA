import { AlertTriangle, Clock, MapPin, User } from 'lucide-react';
import { Matter } from '@/types/legal';
import { cn } from '@/lib/utils';

interface RiskMonitorProps {
  matters: Matter[];
}

export function RiskMonitor({ matters }: RiskMonitorProps) {
  const now = new Date();
  const seventyTwoHours = 72 * 60 * 60 * 1000;
  
  const urgentMatters = matters.filter(c => c.practiceArea === 'litigation').filter(c => {
    const timeToHearing = c.nextHearing.getTime() - now.getTime();
    return timeToHearing > 0 && timeToHearing <= seventyTwoHours;
  }).sort((a, b) => a.nextHearing.getTime() - b.nextHearing.getTime());

  const formatTimeRemaining = (date: Date) => {
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    if (days > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h`;
  };

  if (urgentMatters.length === 0) {
    return (
      <div className="surface-card p-6">
        <div className="flex items-center gap-3 text-success">
          <div className="rounded-lg bg-success/10 p-2">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">No urgent litigation hearings</h3>
            <p className="text-sm text-muted-foreground">
              No matters scheduled within the next 72 hours
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold text-foreground">
          Risk Threshold Monitor
        </h3>
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive whitespace-nowrap">
          {urgentMatters.length} hearing{urgentMatters.length > 1 ? 's' : ''} in 72h
        </span>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {urgentMatters.map((matterItem, index) => (
          <div 
            key={matterItem.id}
            className={cn(
              "risk-alert animate-fade-in",
              index === 0 && "border-l-4"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-destructive whitespace-nowrap">
                    {formatTimeRemaining(matterItem.nextHearing)} remaining
                  </span>
                </div>
                <h4 className="mt-1 font-semibold text-foreground text-sm sm:text-base truncate">
                  {matterItem.suitNumber}
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {matterItem.matterTitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">
                    {matterItem.nextHearing.toLocaleDateString('en-NG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-1 max-w-[120px] sm:max-w-none">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{matterItem.court}</span>
                </div>
                <div className="flex items-center gap-1 max-w-[100px] sm:max-w-none">
                  <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{matterItem.assignedCounsel}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
