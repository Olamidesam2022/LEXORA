import { useMemo, useState } from 'react';
import { 
  Search, 
  Download, 
  Eye, 
  Edit, 
  Plus, 
  Trash2,
  FileText,
  Scale,
  Users,
  Clock,
  Shield,
  Filter
} from 'lucide-react';
import { AuditLog } from '@/types/legal';
import { cn } from '@/lib/utils';
import { AppTablePagination, AppTableShell } from '@/components/ui/app-table';

interface AuditTrailProps {
  logs: AuditLog[];
}

const actionIcons: Record<string, React.ElementType> = {
  VIEW: Eye,
  UPDATE: Edit,
  CREATE: Plus,
  DELETE: Trash2,
  DOWNLOAD: Download,
};

const actionColors: Record<string, string> = {
  VIEW: 'bg-info/10 text-info',
  UPDATE: 'bg-warning/10 text-warning',
  CREATE: 'bg-success/10 text-success',
  DELETE: 'bg-destructive/10 text-destructive',
  DOWNLOAD: 'bg-accent/20 text-accent-foreground',
};

const resourceIcons: Record<string, React.ElementType> = {
  Case: Scale,
  Document: FileText,
  Advisory: FileText,
  User: Users,
};

export function AuditTrail({ logs }: AuditTrailProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string | 'all'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    
    const now = new Date();
    let matchesDate = true;
    if (dateRange === 'today') {
      matchesDate = log.timestamp.toDateString() === now.toDateString();
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = log.timestamp >= weekAgo;
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      matchesDate = log.timestamp >= monthAgo;
    }
    
    return matchesSearch && matchesAction && matchesDate;
  });

  const actions = ['VIEW', 'UPDATE', 'CREATE', 'DELETE', 'DOWNLOAD'];
  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedLogs = useMemo(
    () => filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredLogs],
  );

  const handleExport = () => {
    const headers = ["Timestamp", "User", "Action", "Resource", "Resource ID", "Details", "IP Address"];
    const rows = filteredLogs.map((log) => [
      formatTimestamp(log.timestamp),
      log.userName,
      log.action,
      log.resource,
      log.resourceId,
      log.details,
      log.ipAddress,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            NDPR 2019 compliant activity logging
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          <Shield className="h-4 w-4" />
          <span className="font-medium">NDPR Compliant</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="elevated-card p-4">
          <p className="text-sm text-muted-foreground">Total Events</p>
          <p className="text-2xl font-bold text-foreground">{logs.length}</p>
        </div>
        <div className="elevated-card p-4">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-2xl font-bold text-foreground">
            {logs.filter(l => l.timestamp.toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="elevated-card p-4">
          <p className="text-sm text-muted-foreground">Unique Users</p>
          <p className="text-2xl font-bold text-foreground">
            {new Set(logs.map(l => l.userId)).size}
          </p>
        </div>
        <div className="elevated-card p-4">
          <p className="text-sm text-muted-foreground">Resources Accessed</p>
          <p className="text-2xl font-bold text-foreground">
            {new Set(logs.map(l => l.resourceId)).size}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by user, resource, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="all">All Actions</option>
            {actions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table - Desktop */}
      <AppTableShell className="hidden lg:block">
          <table className="w-full">
            <thead>
              <tr className="table-header sticky-table-header">
                <th className="px-4 py-3 text-left">Timestamp</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Action</th>
                <th className="px-4 py-3 text-left">Resource</th>
                <th className="px-4 py-3 text-left">Details</th>
                <th className="px-4 py-3 text-left">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((log, index) => {
                const ActionIcon = actionIcons[log.action] || Eye;
                const ResourceIcon = resourceIcons[log.resource] || FileText;

                return (
                  <tr 
                    key={log.id} 
                    className="table-row animate-fade-in"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-foreground">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                          {log.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-extrabold text-foreground">{log.userName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", actionColors[log.action])}>
                        <ActionIcon className="h-3 w-3" />
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-semibold text-foreground">{log.resource}</span>
                          <p className="max-w-[150px] truncate text-xs text-muted-foreground">
                            {log.resourceId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate text-sm text-muted-foreground">{log.details}</p>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {log.ipAddress}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold text-foreground">No logs found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
        <AppTablePagination
          page={currentPage}
          pageCount={pageCount}
          total={filteredLogs.length}
          onPageChange={setPage}
        />
      </AppTableShell>

      {/* Audit Log Cards - Mobile/Tablet */}
      <AppTableShell className="lg:hidden">
        {pagedLogs.map((log, index) => {
          const ActionIcon = actionIcons[log.action] || Eye;
          const ResourceIcon = resourceIcons[log.resource] || FileText;

          return (
            <div 
              key={log.id} 
              className="clean-list-row animate-fade-in"
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                    {log.userName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="text-sm font-extrabold text-foreground">{log.userName}</span>
                </div>
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", actionColors[log.action])}>
                  <ActionIcon className="h-3 w-3" />
                  {log.action}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{log.resource}</span>
                <span className="text-muted-foreground">•</span>
                <span className="truncate text-muted-foreground">{log.resourceId}</span>
              </div>

              <p className="text-sm text-muted-foreground">{log.details}</p>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                <code className="rounded bg-muted px-2 py-0.5">
                  {log.ipAddress}
                </code>
              </div>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
            <Filter className="mb-4 h-8 w-8 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-semibold text-foreground">No logs found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
        <AppTablePagination
          page={currentPage}
          pageCount={pageCount}
          total={filteredLogs.length}
          onPageChange={setPage}
        />
      </AppTableShell>
    </div>
  );
}
