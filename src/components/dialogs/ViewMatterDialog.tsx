import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatPracticeArea, Matter } from '@/types/legal';
import { Calendar, MapPin, User, FileText, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewMatterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matterItem: Matter | null;
}

const stageColors = {
  Mention: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Interlocutory: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  Trial: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  Judgment: 'bg-green-500/10 text-green-600 border-green-500/20',
};

const statusColors = {
  Active: 'bg-success/10 text-success',
  Pending: 'bg-warning/10 text-warning',
  Closed: 'bg-muted text-muted-foreground',
  Urgent: 'bg-destructive/10 text-destructive',
  Archived: 'bg-muted text-muted-foreground',
};

export function ViewMatterDialog({ open, onOpenChange, matterItem }: ViewMatterDialogProps) {
  if (!matterItem) return null;
  const isLitigation = matterItem.practiceArea === 'litigation';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{matterItem.matterTitle}</DialogTitle>
              <DialogDescription className="mt-1">
                {formatPracticeArea(matterItem.practiceArea)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badges */}
          <div className="flex flex-wrap gap-2">
            {isLitigation && <Badge variant="outline" className={stageColors[matterItem.proceduralStage]}>
              {matterItem.proceduralStage}
            </Badge>}
            <Badge variant="outline" className={statusColors[matterItem.status]}>
              {matterItem.status}
            </Badge>
          </div>

          {/* Matter Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            {isLitigation && <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Scale className="h-4 w-4" />
                <span>Adversary Party</span>
              </div>
              <p className="font-medium text-foreground">{matterItem.adversaryParty}</p>
            </div>}

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Assigned Counsel</span>
              </div>
              <p className="font-medium text-foreground">{matterItem.assignedCounsel}</p>
            </div>

            {isLitigation && <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Court</span>
              </div>
              <p className="font-medium text-foreground">{matterItem.court}</p>
            </div>}

            {isLitigation && <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Next Hearing</span>
              </div>
              <p className="font-medium text-foreground">
                {matterItem.nextHearing.toLocaleDateString('en-NG', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>}

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Opened</span>
              </div>
              <p className="font-medium text-foreground">
                {matterItem.filedDate.toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Description */}
          {matterItem.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Matter description</h4>
              <p className="text-foreground">{matterItem.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
