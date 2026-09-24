import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AdvisoryInput } from '@/hooks/useAdvisoryRequests';
import { AdvisoryRequest, AdvisoryStatus } from '@/types/legal';

interface AddAdvisoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request?: AdvisoryRequest | null;
  onCreateRequest?: (input: AdvisoryInput) => Promise<void>;
  onUpdateRequest?: (id: string, input: AdvisoryInput) => Promise<void>;
}

const formatDateInput = (date?: Date) => {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

const emptyForm = {
  title: '',
  requestedBy: '',
  department: '',
  status: 'Pending' as AdvisoryStatus,
  priority: '',
  dueDate: '',
  assignedTo: '',
  description: '',
};

export function AddAdvisoryDialog({
  open,
  onOpenChange,
  request,
  onCreateRequest,
  onUpdateRequest,
}: AddAdvisoryDialogProps) {
  const [formData, setFormData] = useState({
    ...emptyForm,
  });

  const [isLoading, setIsLoading] = useState(false);
  const isEditing = Boolean(request);

  useEffect(() => {
    if (!open) return;

    if (request) {
      setFormData({
        title: request.title,
        requestedBy: request.requestedBy,
        department: request.department,
        status: request.status,
        priority: request.priority,
        dueDate: formatDateInput(request.dueDate),
        assignedTo: request.assignedTo === 'Unassigned' ? '' : request.assignedTo,
        description: request.description,
      });
    } else {
      setFormData({ ...emptyForm });
    }
  }, [open, request]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.requestedBy || !formData.department) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      if (request) {
        await onUpdateRequest?.(request.id, formData);
        toast.success('Advisory request updated successfully', {
          description: `Request "${formData.title}" has been updated.`,
        });
      } else {
        await onCreateRequest?.(formData);
        toast.success('Advisory request created successfully', {
          description: `Request "${formData.title}" has been added.`,
        });
      }

      setFormData({ ...emptyForm });
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} advisory request`, {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Advisory Request' : 'New Advisory Request'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the advisory workflow details.' : 'Create a new legal advisory request.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Request Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Contract Review for Vendor Agreement"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="requestedBy">Requested By *</Label>
              <Input
                id="requestedBy"
                placeholder="Name of requester"
                value={formData.requestedBy}
                onChange={(e) => setFormData(prev => ({ ...prev, requestedBy: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Human Resources">Human Resources</SelectItem>
                  <SelectItem value="Procurement">Procurement</SelectItem>
                  <SelectItem value="External Affairs">External Affairs</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as AdvisoryStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign To</Label>
            <Input
              id="assignedTo"
              placeholder="e.g., Barr. Fatima Bello"
              value={formData.assignedTo}
              onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of the advisory request..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Request')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
