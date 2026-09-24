import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, UserRole } from "@/types/legal";

type UserStatus = NonNullable<User["status"]>;

interface EditUserDialogProps {
  open: boolean;
  user: User | null;
  onOpenChange: (open: boolean) => void;
  onSave: (user: User, role: UserRole, status: UserStatus) => Promise<void>;
}

const roleLabels: Record<UserRole, string> = {
  operations_manager: "Operations Manager",
  managing_partner: "Managing Partner",
  legal_officer: "Legal Officer",
};

const statusLabels: Record<UserStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function EditUserDialog({
  open,
  user,
  onOpenChange,
  onSave,
}: EditUserDialogProps) {
  const [role, setRole] = useState<UserRole>("legal_officer");
  const [status, setStatus] = useState<UserStatus>("approved");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setRole(user.role);
    setStatus(user.status || "approved");
  }, [user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      await onSave(user, role, status);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Edit user access</DialogTitle>
          <DialogDescription>
            Update role and approval status for {user?.name || "this user"}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="truncate text-sm font-bold text-foreground">
              {user?.name}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {user?.email}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editUserRole">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
              disabled={isSaving}
            >
              <SelectTrigger id="editUserRole">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as UserRole[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {roleLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editUserStatus">Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as UserStatus)}
              disabled={isSaving}
            >
              <SelectTrigger id="editUserStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as UserStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !user}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
