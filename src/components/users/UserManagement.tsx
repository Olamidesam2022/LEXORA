import { useMemo, useState } from 'react';
import { 
  Search, 
  Plus, 
  Shield, 
  User as UserIcon,
  Edit,
  Eye,
  Trash2,
  Key,
  MoreHorizontal,
} from 'lucide-react';
import { User, UserRole } from '@/types/legal';
import { cn } from '@/lib/utils';
import { AppTablePagination, AppTableShell } from '@/components/ui/app-table';
import { AlignedList, AlignedListRow } from '@/components/ui/aligned-list';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserManagementProps {
  users: User[];
  currentUser: User;
  onAddUser?: () => void;
  onEditUser?: (user: User) => void;
  onDeleteUser?: (user: User) => void;
  onViewAsUser?: (user: User) => void;
  viewingAsUserId?: string | null;
}

const roleStyles: Record<UserRole, { label: string; color: string }> = {
  operations_manager: { label: 'Operations Manager', color: 'bg-accent/20 text-accent-foreground' },
  managing_partner: { label: 'Managing Partner', color: 'bg-secondary text-secondary-foreground' },
  legal_officer: { label: 'Legal Officer', color: 'bg-info/10 text-info' },
};

export function UserManagement({
  users,
  currentUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onViewAsUser,
  viewingAsUserId,
}: UserManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const canManageUsers = Boolean(onEditUser || onDeleteUser || onViewAsUser);
  const availableRoleFilters: Array<UserRole | 'all'> =
    currentUser.role === 'operations_manager'
      ? ['all', 'legal_officer']
      : ['all', 'operations_manager', 'managing_partner', 'legal_officer'];
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedUsers = useMemo(
    () => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredUsers],
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {onAddUser && (
          <button
            onClick={onAddUser}
            className="gold-button flex items-center gap-2 rounded-lg px-4 py-2.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        )}
      </div>

      {/* Role Distribution */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="elevated-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/20 p-2.5">
              <Shield className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter(u => u.role === 'operations_manager' || u.role === 'managing_partner').length}
              </p>
              <p className="text-sm text-muted-foreground">Administrators</p>
            </div>
          </div>
        </div>
        <div className="elevated-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2.5">
              <UserIcon className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {users.filter(u => u.role === 'legal_officer').length}
              </p>
              <p className="text-sm text-muted-foreground">Staff</p>
            </div>
          </div>
        </div>
        <div className="elevated-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5">
              <Key className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{users.length}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input w-full pl-10"
          />
        </div>
        <div className="flex gap-2">
          {availableRoleFilters.map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                roleFilter === role 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {role === 'all' ? 'All Roles' : roleStyles[role].label}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <AppTableShell>
        <AlignedList>
          {pagedUsers.map((user, index) => {
            const isCurrentUser = user.id === currentUser.id;
            return <AlignedListRow
              key={user.id}
              className={cn("animate-fade-in", isCurrentUser && "bg-primary/5")}
              avatar={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>}
              primary={`${user.name}${isCurrentUser ? " (You)" : ""}`}
              secondary={user.email}
              tag={<span title={roleStyles[user.role].label} className={cn("status-pill max-w-full truncate px-1.5 text-[0.68rem]", roleStyles[user.role].color)}>{roleStyles[user.role].label}</span>}
              metric={<span className="truncate text-xs text-muted-foreground">{user.assignedClientCount || 0} client{user.assignedClientCount === 1 ? "" : "s"}</span>}
              date={<span className="text-xs text-muted-foreground">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}</span>}
              action={canManageUsers && <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label={`Actions for ${user.name}`}>
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEditUser && <DropdownMenuItem onSelect={() => onEditUser(user)}><Edit className="mr-2 h-4 w-4" />Edit user</DropdownMenuItem>}
                  {onViewAsUser && <DropdownMenuItem disabled={isCurrentUser} onSelect={() => onViewAsUser(user)}><Eye className="mr-2 h-4 w-4" />{viewingAsUserId === user.id ? "Currently viewing" : "View as user"}</DropdownMenuItem>}
                  {onDeleteUser && <DropdownMenuItem disabled={isCurrentUser} onSelect={() => onDeleteUser(user)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete user</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>}
            />;
          })}
        </AlignedList>
        <AppTablePagination
          page={currentPage}
          pageCount={pageCount}
          total={filteredUsers.length}
          onPageChange={setPage}
        />
      </AppTableShell>

      {/* Empty State */}
      {filteredUsers.length === 0 && (
        <div className="surface-card flex flex-col items-center justify-center border-dashed py-12 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <UserIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No users found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Permissions Info */}
      <div className="surface-card bg-muted/30 p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <Shield className="h-5 w-5 text-accent" />
          Role Permissions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="elevated-card p-4">
            <h4 className="mb-2 font-medium text-foreground">Administrator</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Full access to all modules</li>
              <li>• User management</li>
              <li>• Audit trail access</li>
              <li>• System configuration</li>
            </ul>
          </div>
          <div className="elevated-card p-4">
            <h4 className="mb-2 font-medium text-foreground">Staff</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Matter management</li>
              <li>• Advisory workflow</li>
              <li>• Document access</li>
              <li>• No admin functions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
