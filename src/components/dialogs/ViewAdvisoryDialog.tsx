import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdvisoryRequest } from '@/types/legal';
import { Calendar, User, Building2, Clock, AlertCircle, Pencil, Trash2 } from 'lucide-react';

interface ViewAdvisoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AdvisoryRequest | null;
  onEdit?: (request: AdvisoryRequest) => void;
  onDelete?: (request: AdvisoryRequest) => void;
}

const statusColors = {
  Pending: 'bg-warning/10 text-warning border-warning/20',
  'In Progress': 'bg-info/10 text-info border-info/20',
  Completed: 'bg-success/10 text-success border-success/20',
  Urgent: 'bg-destructive/10 text-destructive border-destructive/20',
};

const priorityColors = {
  Low: 'bg-muted text-muted-foreground',
  Medium: 'bg-info/10 text-info',
  High: 'bg-warning/10 text-warning',
  Critical: 'bg-destructive/10 text-destructive',
};

export function ViewAdvisoryDialog({
  open,
  onOpenChange,
  request,
  onEdit,
  onDelete,
}: ViewAdvisoryDialogProps) {
  if (!request) return null;

  const daysRemaining = Math.ceil(
    (request.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{request.requestNumber}</DialogTitle>
              <DialogDescription className="mt-1">
                {request.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusColors[request.status]}>
              {request.status}
            </Badge>
            <Badge variant="outline" className={priorityColors[request.priority]}>
              {request.priority} Priority
            </Badge>
          </div>

          {/* Due Date Alert */}
          {daysRemaining <= 3 && daysRemaining > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-warning">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Due in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>
            </div>
          )}
          {daysRemaining <= 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Overdue by {Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Request Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Requested By</span>
              </div>
              <p className="font-medium text-foreground">{request.requestedBy}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>Department</span>
              </div>
              <p className="font-medium text-foreground">{request.department}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Assigned To</span>
              </div>
              <p className="font-medium text-foreground">{request.assignedTo}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Due Date</span>
              </div>
              <p className="font-medium text-foreground">
                {request.dueDate.toLocaleDateString('en-NG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Date Received</span>
              </div>
              <p className="font-medium text-foreground">
                {request.dateReceived.toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Description */}
          {request.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Request Description</h4>
              <p className="text-foreground">{request.description}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={() => onDelete?.(request)}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button
            type="button"
            onClick={() => onEdit?.(request)}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Edit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
