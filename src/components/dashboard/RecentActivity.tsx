import { Eye, Edit, Plus, Download, FileText, Scale, Users } from 'lucide-react';
import { AuditLog } from '@/types/legal';
import { cn } from '@/lib/utils';

interface RecentActivityProps {
  logs: AuditLog[];
  onViewAll?: () => void;
}

const actionIcons: Record<string, React.ElementType> = {
  VIEW: Eye,
  UPDATE: Edit,
  CREATE: Plus,
  DOWNLOAD: Download,
};

const resourceIcons: Record<string, React.ElementType> = {
  Case: Scale,
  Document: FileText,
  Advisory: FileText,
  User: Users,
};

export function RecentActivity({ logs, onViewAll }: RecentActivityProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border p-3 sm:p-4">
        <h3 className="font-semibold text-foreground text-sm sm:text-base">Recent Activity</h3>
      </div>
      
      <div className="divide-y divide-border">
        {logs.slice(0, 5).map((log, index) => {
          const ActionIcon = actionIcons[log.action] || Eye;
          const ResourceIcon = resourceIcons[log.resource] || FileText;

          return (
            <div 
              key={log.id} 
              className={cn(
                "flex items-start gap-2 sm:gap-3 p-3 sm:p-4 transition-colors hover:bg-muted/30 animate-fade-in"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                <ActionIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-xs sm:text-sm truncate">{log.userName}</span>
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <span className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</span>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {log.action.toLowerCase()} {log.resource.toLowerCase()}
                </p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ResourceIcon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{log.resourceId}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onViewAll && (
        <div className="border-t border-border p-2 sm:p-3">
          <button
            onClick={onViewAll}
            className="w-full rounded-lg py-2 text-xs sm:text-sm font-medium text-accent transition-colors hover:bg-muted"
          >
            View All Activity
          </button>
        </div>
      )}
    </div>
  );
}
