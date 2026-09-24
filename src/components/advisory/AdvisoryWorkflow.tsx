import { useState } from 'react';
import { 
  Search, 
  Plus, 
  Clock, 
  AlertCircle,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';
import { AdvisoryRequest, AdvisoryStatus } from '@/types/legal';
import { cn } from '@/lib/utils';

interface AdvisoryWorkflowProps {
  requests: AdvisoryRequest[];
  onAddRequest?: () => void;
  onViewRequest?: (request: AdvisoryRequest) => void;
  onEditRequest?: (request: AdvisoryRequest) => void;
  onDeleteRequest?: (request: AdvisoryRequest) => void;
}

const statusConfig: Record<AdvisoryStatus, { icon: React.ElementType; color: string; bgColor: string }> = {
  Pending: { icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  'In Progress': { icon: Loader2, color: 'text-info', bgColor: 'bg-info/10' },
  Completed: { icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  Urgent: { icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

const priorityColors = {
  Low: 'bg-muted text-muted-foreground',
  Medium: 'bg-info/10 text-info',
  High: 'bg-warning/10 text-warning',
  Critical: 'bg-destructive/10 text-destructive',
};

export function AdvisoryWorkflow({
  requests,
  onAddRequest,
  onViewRequest,
  onEditRequest,
  onDeleteRequest,
}: AdvisoryWorkflowProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdvisoryStatus | 'all'>('all');

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.requestedBy.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getDaysRemaining = (dueDate: Date) => {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    return days;
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        {onAddRequest && (
          <button
            onClick={onAddRequest}
            className="gold-button flex items-center justify-center gap-2 rounded-lg px-4 py-2 sm:py-2.5 text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Request</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin" role="tablist" aria-label="Filter advisory requests by status">
          {(['all', 'Urgent', 'Pending', 'In Progress', 'Completed'] as const).map(status => (
            <button
              key={status}
              role="tab"
              aria-selected={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "flex-shrink-0 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap",
                statusFilter === status 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{status === 'all' ? 'All' : status}</span>
              <span className={cn(
                'ml-2 rounded-full px-1.5 py-0.5 text-[11px]',
                statusFilter === status ? 'bg-primary-foreground/15' : 'bg-background/70',
              )}>
                {status === 'all' ? requests.length : requests.filter(request => request.status === status).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filteredRequests.map(request => {
          const { icon: StatusIcon, color, bgColor } = statusConfig[request.status];
          const daysRemaining = getDaysRemaining(request.dueDate);
          const dueLabel = request.status === 'Completed'
            ? 'Completed'
            : daysRemaining < 0
              ? `Overdue ${Math.abs(daysRemaining)} days`
              : daysRemaining === 0
                ? 'Due today'
                : `Due in ${daysRemaining} days`;

          return (
            <article key={request.id} className="surface-card overflow-hidden rounded-xl">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onViewRequest?.(request)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-xs font-medium text-muted-foreground">{request.requestNumber}</span>
                    <span className="mt-1 block break-words text-base font-semibold text-primary sm:text-lg">{request.title}</span>
                  </button>
                  <div className="flex max-w-full flex-wrap items-center gap-2">
                    <span className={cn('status-pill inline-flex items-center gap-1.5', bgColor, color)}>
                      <StatusIcon className={cn('h-3.5 w-3.5', request.status === 'In Progress' && 'animate-spin')} />
                      {request.status}
                    </span>
                    <span className={cn('status-pill', priorityColors[request.priority])}>
                      {request.priority} priority
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Department</span>
                    <span className="mt-1 block break-words text-sm font-medium text-foreground">{request.department}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Requested by</span>
                    <span className="mt-1 block break-words text-sm font-medium text-foreground">{request.requestedBy}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Due date</span>
                    <span className={cn('mt-1 block text-sm font-medium text-foreground', daysRemaining <= 1 && request.status !== 'Completed' && 'text-destructive')}>
                      {dueLabel}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs text-muted-foreground">Assigned to</span>
                    <span className="mt-1 block break-words text-sm font-medium text-foreground">{request.assignedTo || 'Unassigned'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-2.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => onViewRequest?.(request)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-primary transition-colors hover:bg-primary/5"
                >
                  <Eye className="h-4 w-4" />
                  View
                </button>
                <div className="flex items-center gap-1">
                  {onEditRequest && (
                    <button
                      type="button"
                      onClick={() => onEditRequest(request)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Edit ${request.title}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {onDeleteRequest && (
                    <button
                      type="button"
                      onClick={() => onDeleteRequest(request)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${request.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {filteredRequests.length === 0 && (
          <div className="surface-card rounded-xl px-4 py-10 text-center text-sm text-muted-foreground">
            No advisory requests match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
