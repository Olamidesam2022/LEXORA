import { useEffect, useMemo, useState } from 'react';
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
import { LitigationStatus, Matter, PracticeArea, ProceduralStage, User } from '@/types/legal';
import { toast } from 'sonner';

interface AddMatterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMatter?: (input: {
    title: string;
    clientId?: string;
    practiceArea?: Exclude<PracticeArea, "needs_review">;
    description?: string;
    suitNumber?: string;
    adversaryParty?: string;
    proceduralStage?: string;
    assignedCounsel?: string;
    assignedTo?: string;
    assignedUserIds?: string[];
    court?: string;
    nextHearing?: string;
    filingDeadline?: string;
    status?: string;
  }) => Promise<void>;
  matterItem?: Matter | null;
  users?: User[];
  clients?: Array<{ id: string; display_name: string }>;
  canAssignMatter?: boolean;
}

export function AddMatterDialog({
  open,
  onOpenChange,
  onCreateMatter,
  matterItem,
  users = [],
  clients = [],
  canAssignMatter = false,
}: AddMatterDialogProps) {
  const [formData, setFormData] = useState({
    clientId: '',
    practiceArea: 'corporate_commercial' as PracticeArea,
    suitNumber: '',
    matterTitle: '',
    adversaryParty: '',
    proceduralStage: '' as ProceduralStage | '',
    assignedCounsel: '',
    assignedTo: '',
    assignedUserIds: [] as string[],
    court: '',
    nextHearing: '',
    filingDeadline: '',
    status: 'Active' as LitigationStatus,
    description: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const assignableUsers = useMemo(
    () =>
      users
        .filter((user) => user.status === "approved" && user.role === "legal_officer")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [users],
  );

  useEffect(() => {
    if (!open) return;

    if (matterItem) {
      let meta: { filingDeadline?: string | null } = {};
      try {
        meta = matterItem.description ? JSON.parse(matterItem.description) : {};
      } catch {
        meta = {};
      }

      setFormData({
        clientId: matterItem.clientId || '',
        practiceArea: matterItem.practiceArea || 'needs_review',
        suitNumber: matterItem.suitNumber === "Unassigned" ? "" : matterItem.suitNumber,
        matterTitle: matterItem.matterTitle,
        adversaryParty: matterItem.adversaryParty === "Unspecified" ? "" : matterItem.adversaryParty,
        proceduralStage: matterItem.proceduralStage,
        assignedCounsel: matterItem.assignedCounsel === "Unassigned" ? "" : matterItem.assignedCounsel,
        assignedTo: matterItem.assignedTo || '',
        assignedUserIds: matterItem.assignedUserIds?.length
          ? matterItem.assignedUserIds
          : matterItem.assignedTo
            ? [matterItem.assignedTo]
            : [],
        court: matterItem.court === "Unspecified" ? "" : matterItem.court,
        nextHearing: matterItem.nextHearing.toISOString().slice(0, 10),
        filingDeadline: meta.filingDeadline || '',
        status: matterItem.status,
        description: matterItem.description,
      });
    } else {
      setFormData({
        clientId: '',
        practiceArea: 'corporate_commercial',
        suitNumber: '',
        matterTitle: '',
        adversaryParty: '',
        proceduralStage: '',
        assignedCounsel: '',
        assignedTo: '',
        assignedUserIds: [],
        court: '',
        nextHearing: '',
        filingDeadline: '',
        status: 'Active',
        description: '',
      });
    }
  }, [matterItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.clientId || !formData.matterTitle || formData.practiceArea === 'needs_review') {
      toast.error('Select a client, practice area, and matter title first');
      return;
    }

    setIsLoading(true);
    try {
      const isLitigation = formData.practiceArea === "litigation";
      await onCreateMatter?.({
        title: formData.matterTitle,
        clientId: formData.clientId,
        practiceArea: formData.practiceArea as Exclude<PracticeArea, "needs_review">,
        description: formData.description,
        suitNumber: isLitigation ? formData.suitNumber : "",
        adversaryParty: isLitigation ? formData.adversaryParty : "",
        proceduralStage: isLitigation ? formData.proceduralStage || "Mention" : "",
        assignedCounsel: formData.assignedCounsel,
        assignedTo: canAssignMatter ? formData.assignedTo : undefined,
        assignedUserIds: canAssignMatter ? formData.assignedUserIds : undefined,
        court: isLitigation ? formData.court : "",
        nextHearing: isLitigation ? formData.nextHearing : "",
        filingDeadline: isLitigation ? formData.filingDeadline : "",
        status: formData.status,
      });

      toast.success(
        matterItem
          ? 'Matter updated successfully'
          : `${formData.matterTitle} opened successfully.`,
        {
          description: `Matter ${formData.matterTitle} has been saved.`,
          action: !matterItem
            ? {
                label: "Copy",
                onClick: () => navigator.clipboard?.writeText(isLitigation ? formData.suitNumber : formData.matterTitle),
              }
            : undefined,
        },
      );
      
      setFormData({
        clientId: '',
        practiceArea: 'corporate_commercial',
        suitNumber: '',
        matterTitle: '',
        adversaryParty: '',
        proceduralStage: '',
        assignedCounsel: '',
        assignedTo: '',
        assignedUserIds: [],
        court: '',
        nextHearing: '',
        filingDeadline: '',
        status: 'Active',
        description: '',
      });
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save matter', {
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignedUserToggle = (userId: string) => {
    setFormData((prev) => {
      const assignedUserIds = prev.assignedUserIds.includes(userId)
        ? prev.assignedUserIds.filter((id) => id !== userId)
        : [...prev.assignedUserIds, userId];
      const selectedUsers = assignableUsers.filter((account) =>
        assignedUserIds.includes(account.id),
      );

      return {
        ...prev,
        assignedTo: selectedUsers[0]?.id || "",
        assignedUserIds,
        assignedCounsel: selectedUsers.map((account) => account.name).join(", "),
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{matterItem ? "Edit Matter" : "Open Matter"}</DialogTitle>
          <DialogDescription>
            Link this matter to a client and practice area. Court details apply to litigation matters.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="matterClient">Client *</Label>
              <Select value={formData.clientId} onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}>
                <SelectTrigger id="matterClient"><SelectValue placeholder="Select a client" /></SelectTrigger>
                <SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.display_name}</SelectItem>)}</SelectContent>
              </Select>
              {clients.length === 0 && <p className="text-xs text-muted-foreground">Create a client in Client 360 before opening a matter.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="practiceArea">Practice area *</Label>
              <Select value={formData.practiceArea} onValueChange={(value) => setFormData(prev => ({ ...prev, practiceArea: value as PracticeArea }))}>
                <SelectTrigger id="practiceArea"><SelectValue placeholder="Select practice area" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate_commercial">Corporate &amp; commercial</SelectItem>
                  <SelectItem value="ma">M&amp;A</SelectItem>
                  <SelectItem value="tech_ip">Tech &amp; IP</SelectItem>
                  <SelectItem value="contracts">Contracts</SelectItem>
                  <SelectItem value="regulatory_compliance">Regulatory &amp; compliance</SelectItem>
                  <SelectItem value="corporate_secretarial">Corporate secretarial</SelectItem>
                  <SelectItem value="adr">ADR</SelectItem>
                  <SelectItem value="litigation">Litigation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formData.practiceArea === "litigation" && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="suitNumber">Suit number *</Label>
              <Input
                id="suitNumber"
                placeholder="e.g., FHC/L/CS/001/2024"
                value={formData.suitNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, suitNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="court">Court</Label>
              <Input
                id="court"
                placeholder="e.g., Federal High Court Lagos"
                value={formData.court}
                onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
              />
            </div>
          </div>}

          <div className="space-y-2">
            <Label htmlFor="matterTitle">Matter title *</Label>
            <Input
              id="matterTitle"
              placeholder="e.g., Share Purchase Agreement - Acme Ltd"
              value={formData.matterTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, matterTitle: e.target.value }))}
            />
          </div>

          {formData.practiceArea === "litigation" && <div className="space-y-2">
            <Label htmlFor="adversaryParty">Adversary Party *</Label>
            <Input
              id="adversaryParty"
              placeholder="Name of opposing party"
              value={formData.adversaryParty}
              onChange={(e) => setFormData(prev => ({ ...prev, adversaryParty: e.target.value }))}
            />
          </div>}

          {canAssignMatter && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="space-y-2">
                <Label>Assign Legal Officers</Label>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card">
                  {assignableUsers.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      No approved legal user accounts available
                    </p>
                  ) : (
                    assignableUsers.map((account) => (
                      <label
                        key={account.id}
                        className="flex cursor-pointer items-start gap-3 border-b border-border p-3 text-sm last:border-0 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.assignedUserIds.includes(account.id)}
                          onChange={() => handleAssignedUserToggle(account.id)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-foreground">
                            {account.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {account.email} - {account.role}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected Legal Officers will be able to access this matter.
                </p>
              </div>
            </div>
          )}

          {formData.practiceArea === "litigation" && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="proceduralStage">Procedural Stage</Label>
              <Select
                value={formData.proceduralStage}
                onValueChange={(value) => setFormData(prev => ({ ...prev, proceduralStage: value as ProceduralStage }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mention">Mention</SelectItem>
                  <SelectItem value="Interlocutory">Interlocutory</SelectItem>
                  <SelectItem value="Trial">Trial</SelectItem>
                  <SelectItem value="Judgment">Judgment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Litigation progress</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as LitigationStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>}

          {formData.practiceArea === "litigation" && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assignedCounsel">Assigned Counsel</Label>
              <Input
                id="assignedCounsel"
                placeholder={canAssignMatter ? "Filled from assigned account" : "e.g., Barr. Adamu Johnson"}
                value={formData.assignedCounsel}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedCounsel: e.target.value }))}
                readOnly={canAssignMatter && Boolean(formData.assignedTo)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextHearing">Next Date</Label>
              <Input
                id="nextHearing"
                type="date"
                value={formData.nextHearing}
                onChange={(e) => setFormData(prev => ({ ...prev, nextHearing: e.target.value }))}
              />
            </div>
          </div>}

          {formData.practiceArea === "litigation" && <div className="space-y-2">
            <Label htmlFor="filingDeadline">Filing Date</Label>
            <Input
              id="filingDeadline"
              type="date"
              value={formData.filingDeadline}
              onChange={(e) => setFormData(prev => ({ ...prev, filingDeadline: e.target.value }))}
            />
          </div>}

          <div className="space-y-2">
            <Label htmlFor="description">Matter description</Label>
            <Textarea
              id="description"
              placeholder="Brief description of the matter..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : matterItem ? 'Save Matter' : 'Create Matter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
