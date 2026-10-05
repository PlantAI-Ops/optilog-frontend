import { useEffect, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserRoleBadge } from "./UserRoleBadge";
import { EmptyState } from "./EmptyState";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserSelection, UserBulkActions } from "./UserBulkActions";
import type { SystemUser, Role } from "@/lib/shift-log";
import type { UserListFilters } from "@/lib/admin-hooks";

interface TenantUserTableProps {
  users: SystemUser[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onFiltersChange: (filters: UserListFilters) => void;
  onEditUser: (user: SystemUser) => void;
  onDeleteUser: (user: SystemUser) => void;
  plants: { id: string; name: string }[];
  loading?: boolean;
  onAddUser?: () => void;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "operator", label: "Operator" },
  { value: "technician", label: "Technician" },
  { value: "supervisor", label: "Supervisor" },
  { value: "shift_manager", label: "Shift Manager" },
  { value: "plant_manager", label: "Plant Manager" },
  { value: "integration_admin", label: "Integration Admin" },
  // system_admin intentionally omitted - can't grant via this UI
];

export function TenantUserTable({
  users,
  total,
  page,
  limit,
  onPageChange,
  onFiltersChange,
  onEditUser,
  onDeleteUser,
  plants,
  loading,
  onAddUser,
}: TenantUserTableProps) {
  const usersArray = users ?? [];
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selection = useUserSelection();

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const activeParam = (): boolean | "all" =>
    activeFilter === "all" ? "all" : activeFilter === "true";

  const emitFilters = (overrides: { search?: string; role?: Role | "all"; active?: boolean | "all" } = {}) => {
    const filters: UserListFilters = {};
    const s = overrides.search ?? "";
    const r = overrides.role ?? roleFilter;
    const a = overrides.active ?? activeParam();
    if (s) filters.search = s;
    if (r !== "all") filters.role = r;
    filters.active = a;
    selection.clear();
    onFiltersChange(filters);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => emitFilters({ search: value }), 300);
  };

  const handleRoleChange = (value: string) => {
    const roleValue = value === "all" ? "all" : (value as Role);
    setRoleFilter(roleValue);
    emitFilters({ role: roleValue, search });
  };

  const handleActiveChange = (value: string) => {
    const activeValue = value as "all" | "true" | "false";
    setActiveFilter(activeValue);
    emitFilters({
      active: activeValue === "all" ? "all" : activeValue === "true",
      search,
    });
  };

  const totalPages = Math.ceil(total / limit);
  const pageIds = usersArray.map((u) => u.id);
  const selectedOnPage = pageIds.filter((id) => selection.selected.has(id)).length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-secondary/50 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-secondary/50 rounded" />
                <div className="h-3 w-1/2 bg-secondary/50 rounded" />
              </div>
              <div className="h-6 w-20 bg-secondary/50 rounded-full" />
              <div className="h-6 w-24 bg-secondary/50 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={handleRoleChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLE_OPTIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeFilter} onValueChange={handleActiveChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions (selection bar) */}
      <UserBulkActions
        selectedUsers={usersArray.filter((u) => selection.selected.has(u.id))}
        onClear={selection.clear}
        surface="tenant"
        plants={plants}
      />

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3">
                <Checkbox
                  aria-label="Select all users on this page"
                  checked={
                    pageIds.length > 0 && selectedOnPage === pageIds.length
                      ? true
                      : selectedOnPage > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) => selection.selectMany(pageIds, checked === true)}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plants</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersArray.length === 0 ? (
              <tr>
                <td colSpan={7}>
                    <EmptyState
                      icon={UserPlus}
                      title={total === 0 && !search && roleFilter === "all" && activeFilter === "all" ? "NO MEMBERS" : "NO MATCHING USERS"}
                      description={
                        total === 0 && !search && roleFilter === "all" && activeFilter === "all"
                          ? "Add a member to this tenant to start assigning them to plants and shifts"
                          : "Try adjusting your filters or search terms"
                      }
                      {...(total === 0 && !search && roleFilter === "all" && activeFilter === "all" && onAddUser
                        ? { action: { label: "Add Member", onClick: () => onAddUser(), icon: UserPlus } }
                        : {})}
                      variant="inline"
                    />
                  </td>
              </tr>
            ) : (
              usersArray.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      aria-label={`Select ${user.name}`}
                      checked={selection.selected.has(user.id)}
                      onCheckedChange={() => selection.toggle(user.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <UserRoleBadge role={user.role} variant="compact" />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.team_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.plant_ids.slice(0, 3).map((plantId: string) => (
                        <Badge key={plantId} variant="outline" className="text-xs">
                          {user.plant_names?.[plantId] ??
                            plants.find((p) => p.id === plantId)?.name ??
                            plantId.slice(0, 8) + "..."}
                        </Badge>
                      ))}
                      {user.plant_ids.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.plant_ids.length - 3}
                        </Badge>
                      )}
                      {user.plant_ids.length === 0 && (
                        <span className="text-xs text-muted-foreground">No plants</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.active ? "default" : "destructive"} className="text-xs">
                      {user.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditUser(user)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} — {total} users
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selection.clear();
                onPageChange(page - 1);
              }}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                selection.clear();
                onPageChange(page + 1);
              }}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
