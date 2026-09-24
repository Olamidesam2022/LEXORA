import { useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserRole } from '@/types/legal';
import { toast } from 'sonner';
import { Copy, ExternalLink } from 'lucide-react';

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: () => void;
}

export function AddUserDialog({ open, onOpenChange, onUserCreated }: AddUserDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '' as UserRole | '',
    department: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const signupUrl = useMemo(() => `${window.location.origin}/signup`, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const inviteText = [
        `Hello ${formData.name},`,
        '',
        'Please create your LEXORA account using this link:',
        signupUrl,
        '',
        `Use this email: ${formData.email}`,
        `Select account type: ${formData.role === 'operations_manager' ? 'Admin' : 'Legal User'}`,
        formData.department ? `Department: ${formData.department}` : '',
        '',
        'After signup, a Managing Partner will approve your account before you can log in.',
      ].filter(Boolean).join('\n');

      await navigator.clipboard.writeText(inviteText);
      toast.success('Signup instructions copied', {
        description: 'Send them to the user, then approve their profile after signup.',
      });

      setFormData({
        name: '',
        email: '',
        role: '',
        department: '',
      });
      onOpenChange(false);
      onUserCreated?.();
    } catch (error) {
      console.error('Error preparing invite:', error);
      toast.error('Failed to copy invite instructions', {
        description: error.message || 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Prepare signup instructions for a new user. Supabase will create the auth account when the user signs up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userName">Full Name *</Label>
            <Input
              id="userName"
              placeholder="e.g., Adamu Johnson"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userEmail">Email Address *</Label>
            <Input
              id="userEmail"
              type="email"
              placeholder="e.g., adamu.johnson@lawfirm.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="userRole">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legal_officer">Legal Officer</SelectItem>
                <SelectItem value="operations_manager">Operations Manager</SelectItem>
                <SelectItem value="managing_partner">Managing Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userDepartment">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Legal">Legal</SelectItem>
                <SelectItem value="Litigation">Litigation</SelectItem>
                <SelectItem value="Advisory">Advisory</SelectItem>
                <SelectItem value="Compliance">Compliance</SelectItem>
                <SelectItem value="Corporate Affairs">Corporate Affairs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => window.open(signupUrl, '_blank')} disabled={isLoading}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Signup
            </Button>
            <Button type="submit" disabled={isLoading}>
              <Copy className="mr-2 h-4 w-4" />
              {isLoading ? 'Copying...' : 'Copy Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
