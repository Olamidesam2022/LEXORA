import { Eye, Edit, Plus, Download, FileText, Scale, Users } from 'lucide-react';
import { AuditLog } from '@/types/legal';
import { AlignedList, AlignedListRow } from '@/components/ui/aligned-list';

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

      <AlignedList>
        {logs.slice(0, 5).map((log) => {
          const ActionIcon = actionIcons[log.action] || Eye;
          const ResourceIcon = resourceIcons[log.resource] || FileText;
          return <AlignedListRow
            key={log.id}
            avatar={<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><ActionIcon className="h-4 w-4 text-muted-foreground" /></span>}
            primary={log.userName}
            secondary={`${log.action.toLowerCase()} ${log.resource.toLowerCase()}`}
            tag={<span className="truncate text-xs capitalize text-muted-foreground">{log.resource}</span>}
            metric={<span className="flex min-w-0 items-center justify-end gap-1 text-xs text-muted-foreground"><ResourceIcon className="h-3 w-3 shrink-0" /><span className="truncate">{log.resourceId}</span></span>}
            date={formatTime(log.timestamp)}
          />;
        })}
      </AlignedList>

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
