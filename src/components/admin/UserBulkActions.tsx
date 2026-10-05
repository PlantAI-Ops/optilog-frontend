import { useMemo, useState, type ReactNode } from "react";
import { Check, Loader2, Minus, Plus, RefreshCw, UserCheck, UserX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { SystemUser, Role } from "@/lib/shift-log";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import {
  useBulkDeleteUsers,
  useBulkUpdateUsers,
  useTenantPlants,
  type BulkUpdateResult,
} from "@/lib/admin-hooks";

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "operator", label: "Operator", description: "Floor capture only" },
  { value: "technician", label: "Technician", description: "Maintenance tasks" },
  { value: "supervisor", label: "Supervisor", description: "Shift oversight" },
  { value: "shift_manager", label: "Shift Manager", description: "Shift scheduling" },
  { value: "plant_manager", label: "Plant Manager", description: "Plant admin" },
  { value: "integration_admin", label: "Integration Admin", description: "Integrations config" },
  // system_admin excluded - cannot grant via this UI
];

const roleLabel = (role: Role) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

/** Checkbox selection for a paginated table. Cleared on page/filter changes. */
export function useUserSelection() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  return {
    selected,
    toggle: (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    selectMany: (ids: string[], checked: boolean) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    clear: () => setSelected(new Set()),
  };
}

interface UserBulkActionsProps {
  /** Selected users resolved from the visible page (used for names/tenants). */
  selectedUsers: SystemUser[];
  onClear: () => void;
  /** "system" = cross-tenant table, "tenant" = single-tenant table. */
  surface: "system" | "tenant";
  /** Tenant surface: plants already loaded by the page. */
  plants?: { id: string; name: string }[];
}

interface FailureRow {
  id: string;
  error: string;
  label: string;
}

interface ConfirmSpec {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => Promise<void>;
}

export function UserBulkActions({ selectedUsers, onClear, surface, plants }: UserBulkActionsProps) {
  const caller = useShiftLog().user;
  const ids = useMemo(() => selectedUsers.map((u) => u.id), [selectedUsers]);
  const userById = useMemo(
    () => new Map(selectedUsers.map((u) => [u.id, u])),
    [selectedUsers],
  );

  const bulkUpdate = useBulkUpdateUsers();
  const bulkDelete = useBulkDeleteUsers();

  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const [plantDialog, setPlantDialog] = useState<null | "add" | "remove">(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [failures, setFailures] = useState<FailureRow[] | null>(null);
  const [pickedPlants, setPickedPlants] = useState<string[]>([]);
  const [pickedRole, setPickedRole] = useState<Role>("operator");

  // The backend rejects plant_ids that do not belong to each target user's
  // tenant, so plant actions are only offered when the selection shares one.
  const sharedTenantId = useMemo(() => {
    if (selectedUsers.length === 0) return null;
    const first = selectedUsers[0]?.tenant_id;
    if (!first || !selectedUsers.every((u) => u.tenant_id === first)) return null;
    return first;
  }, [selectedUsers]);
  const tenantPlantsQuery = useTenantPlants(
    surface === "system" ? (sharedTenantId ?? undefined) : undefined,
  );
  const plantList = surface === "tenant" ? (plants ?? []) : (tenantPlantsQuery.data ?? []);
  const plantsReady = surface === "tenant" || sharedTenantId !== null;

  // ---- Prechecks: skip users/plants/roles an action would not change ----
  const activatable = useMemo(
    () => selectedUsers.filter((u) => !u.active),
    [selectedUsers],
  );
  const deactivatable = useMemo(
    () => selectedUsers.filter((u) => u.active),
    [selectedUsers],
  );
  // Assign: hide plants every selected user already has. Remove: only plants
  // at least one selected user actually has.
  const plantCandidates = useMemo(() => {
    if (!plantDialog) return [];
    return plantList.filter((p) =>
      plantDialog === "add"
        ? selectedUsers.some((u) => !u.plant_ids.includes(p.id))
        : selectedUsers.some((u) => u.plant_ids.includes(p.id)),
    );
  }, [plantDialog, plantList, selectedUsers]);
  const affectedUsers = useMemo(() => {
    if (!plantDialog || pickedPlants.length === 0) return selectedUsers;
    return selectedUsers.filter((u) =>
      plantDialog === "add"
        ? pickedPlants.some((pid) => !u.plant_ids.includes(pid))
        : pickedPlants.some((pid) => u.plant_ids.includes(pid)),
    );
  }, [plantDialog, pickedPlants, selectedUsers]);
  const roleChanges = useMemo(
    () => selectedUsers.filter((u) => u.role !== pickedRole),
    [selectedUsers, pickedRole],
  );

  const roleOptions = ROLE_OPTIONS.filter((r) => caller && hasMinRole(caller.role, r.value));
  const pending = bulkUpdate.isPending || bulkDelete.isPending;
  const activateDisabled = pending || activatable.length === 0;
  const deactivateDisabled = pending || deactivatable.length === 0;

  const emailPreview = (users: SystemUser[]) => {
    const first = users.slice(0, 5);
    const rest = users.length - first.length;
    return (
      <>
        {first.map((u) => u.email).join(", ")}
        {rest > 0 ? ` and ${rest} more` : ""}.
      </>
    );
  };

  /** Partial-count suffix: only when a strict subset would change. */
  const countSuffix = (n: number) =>
    n > 0 && n < selectedUsers.length ? ` (${n}/${selectedUsers.length})` : "";

  const finish = (res: BulkUpdateResult, okMsg: string) => {
    if (res.failed.length === 0) {
      toast.success(okMsg);
    } else {
      toast.warning(`${res.updated} applied - ${res.failed.length} skipped`);
      setFailures(
        res.failed.map((f) => {
          const u = userById.get(f.id);
          return { id: f.id, error: f.error, label: u ? `${u.name} (${u.email})` : f.id };
        }),
      );
    }
    onClear();
  };

  const handleActivate = async () => {
    if (activatable.length === 0) return;
    try {
      const res = await bulkUpdate.mutateAsync({
        user_ids: activatable.map((u) => u.id),
        patch: { active: true },
      });
      finish(res, `Activated ${res.updated} user(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to activate users");
    }
  };

  const handleDeactivate = async () => {
    if (deactivatable.length === 0) return;
    try {
      const res = await bulkDelete.mutateAsync(deactivatable.map((u) => u.id));
      finish(res, `Deactivated ${res.updated} user(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate users");
    }
  };

  const openActivateConfirm = () =>
    setConfirm({
      title: `Activate ${activatable.length} user(s)?`,
      description: (
        <>
          {activatable.length} of {selectedUsers.length} selected users are inactive and will be
          re-activated. {selectedUsers.length - activatable.length > 0
            ? `${selectedUsers.length - activatable.length} already-active user(s) will be skipped. ` : ""}
          Targets: {emailPreview(activatable)}
        </>
      ),
      confirmLabel: "Activate",
      destructive: false,
      onConfirm: handleActivate,
    });

  const openDeactivateConfirm = () =>
    setConfirm({
      title: `Deactivate ${deactivatable.length} user(s)?`,
      description: (
        <>
          This revokes their access but preserves their data - same as the single-user
          deactivate. They can be re-activated later. {deactivatable.length} of{" "}
          {selectedUsers.length} selected users are active
          {deactivatable.length < selectedUsers.length
            ? `; ${selectedUsers.length - deactivatable.length} already-inactive user(s) will be skipped. `
            : ". "}
          Targets: {emailPreview(deactivatable)}
        </>
      ),
      confirmLabel: "Deactivate",
      destructive: true,
      onConfirm: handleDeactivate,
    });

  const handleApplyPlants = async () => {
    if (!plantDialog || pickedPlants.length === 0) return;
    try {
      const res = await bulkUpdate.mutateAsync({
        user_ids: ids,
        patch: { plant_ids: pickedPlants },
        plant_mode: plantDialog,
      });
      finish(
        res,
        plantDialog === "add"
          ? `Assigned ${pickedPlants.length} plant(s) - ${affectedUsers.length} user(s) affected`
          : `Removed ${pickedPlants.length} plant(s) - ${affectedUsers.length} user(s) affected`,
      );
      setPlantDialog(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update plants");
    } finally {
      setConfirm(null);
    }
  };

  const openPlantConfirm = () => {
    if (!plantDialog || pickedPlants.length === 0) return;
    const names = pickedPlants
      .map((pid) => plantList.find((p) => p.id === pid)?.name ?? pid.slice(0, 8))
      .join(", ");
    setConfirm({
      title:
        plantDialog === "add"
          ? `Assign ${pickedPlants.length} plant(s) to ${affectedUsers.length} user(s)?`
          : `Remove ${pickedPlants.length} plant(s) from ${affectedUsers.length} user(s)?`,
      description: (
        <>
          Plants: {names}. {affectedUsers.length} of {selectedUsers.length} selected user(s) will
          be affected; the rest are unchanged. Targets: {emailPreview(affectedUsers)}
        </>
      ),
      confirmLabel: plantDialog === "add" ? "Assign" : "Remove",
      destructive: plantDialog === "remove",
      onConfirm: handleApplyPlants,
    });
  };

  const handleApplyRole = async () => {
    if (roleChanges.length === 0) return;
    try {
      const res = await bulkUpdate.mutateAsync({
        user_ids: roleChanges.map((u) => u.id),
        patch: { role: pickedRole },
      });
      finish(res, `Role set for ${res.updated} user(s)`);
      setRoleDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change roles");
    } finally {
      setConfirm(null);
    }
  };

  const openRoleConfirm = () => {
    if (roleChanges.length === 0) return;
    setConfirm({
      title: `Set role to ${roleLabel(pickedRole)} for ${roleChanges.length} user(s)?`,
      description: (
        <>
          {roleChanges.length} of {selectedUsers.length} selected user(s) will change role
          {roleChanges.length < selectedUsers.length
            ? `; ${selectedUsers.length - roleChanges.length} already have this role. `
            : ". "}
          You can only grant roles at or below your own rank. Targets:{" "}
          {emailPreview(roleChanges)}
        </>
      ),
      confirmLabel: "Change role",
      destructive: false,
      onConfirm: handleApplyRole,
    });
  };

  if (selectedUsers.length === 0) return null;

  const activateReason =
    activatable.length === 0 ? "All selected users are already active" : undefined;
  const deactivateReason =
    deactivatable.length === 0 ? "All selected users are already inactive" : undefined;

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card px-3 py-2">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          <span className="tabular-nums">{selectedUsers.length}</span> selected
        </span>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <span title={activateReason}>
          <Button
            size="sm"
            variant="secondary"
            onClick={openActivateConfirm}
            disabled={activateDisabled}
          >
            <UserCheck className="mr-1.5 size-3.5" />
            Activate{countSuffix(activatable.length)}
          </Button>
        </span>
        <span title={deactivateReason}>
          <Button
            size="sm"
            variant="ghost"
            onClick={openDeactivateConfirm}
            disabled={deactivateDisabled}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <UserX className="mr-1.5 size-3.5" />
            Deactivate{countSuffix(deactivatable.length)}
          </Button>
        </span>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPickedPlants([]);
            setPlantDialog("add");
          }}
          disabled={pending || !plantsReady}
        >
          <Plus className="mr-1.5 size-3.5" />
          Assign plants
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPickedPlants([]);
            setPlantDialog("remove");
          }}
          disabled={pending || !plantsReady}
        >
          <Minus className="mr-1.5 size-3.5" />
          Remove plants
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPickedRole("operator");
            setRoleDialog(true);
          }}
          disabled={pending || roleOptions.length === 0}
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          Change role
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          disabled={pending}
          aria-label="Clear selection"
          title="Clear selection"
          className="ml-auto px-2"
        >
          <X className="size-4" />
        </Button>
      </div>
      {!plantsReady && (
        <p className="text-xs text-muted-foreground">
          Plant assignment is available when all selected users belong to the same tenant.
        </p>
      )}

      {/* Shared confirmation for every bulk action */}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={
                    confirm.destructive
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : undefined
                  }
                  onClick={() => void confirm.onConfirm()}
                  disabled={pending}
                >
                  {confirm.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign / remove plants */}
      <Dialog open={plantDialog !== null} onOpenChange={(open) => !open && setPlantDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {plantDialog === "add" ? "Assign plants" : "Remove plants"} -{" "}
              {selectedUsers.length} user(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              {plantDialog === "add"
                ? "Plants to add (existing assignments are kept)"
                : "Plants to remove (other assignments are kept)"}
            </Label>
            {surface === "system" && tenantPlantsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading plants...</p>
            ) : plantList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No plants in this tenant yet</p>
            ) : plantCandidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {plantDialog === "add"
                  ? "All selected users already have access to every plant."
                  : "Selected users have no plant assignments."}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {plantCandidates.map((p) => {
                  const selected = pickedPlants.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        setPickedPlants(
                          selected
                            ? pickedPlants.filter((id) => id !== p.id)
                            : [...pickedPlants, p.id],
                        )
                      }
                      className={
                        selected
                          ? "inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                          : "inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                      }
                    >
                      {selected && <Check className="size-3" />}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
            {pickedPlants.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{affectedUsers.length}</span> of{" "}
                <span className="tabular-nums">{selectedUsers.length}</span> selected user(s) will
                be affected; the rest are unchanged.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPlantDialog(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={openPlantConfirm}
              disabled={pending || pickedPlants.length === 0}
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {plantDialog === "add" ? "Assign" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change role */}
      <Dialog open={roleDialog} onOpenChange={setRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role - {selectedUsers.length} user(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New role for every selected user</Label>
            <Select value={pickedRole} onValueChange={(v) => setPickedRole(v as Role)} disabled={pending}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <p className="font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {roleChanges.length === 0 ? (
                <>
                  All selected users already have the{" "}
                  <span className="font-medium text-foreground">{roleLabel(pickedRole)}</span>{" "}
                  role - nothing to change.
                </>
              ) : (
                <>
                  <span className="tabular-nums">{roleChanges.length}</span> of{" "}
                  <span className="tabular-nums">{selectedUsers.length}</span> user(s) will change
                  {roleChanges.length < selectedUsers.length
                    ? ` - ${selectedUsers.length - roleChanges.length} already have this role.`
                    : "."}
                </>
              )}{" "}
              You can only grant roles at or below your own rank; users who outrank you are
              skipped and reported afterwards.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleDialog(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={openRoleConfirm}
              disabled={pending || roleChanges.length === 0}
            >
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial-failure report */}
      <Dialog open={failures !== null} onOpenChange={(open) => !open && setFailures(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Some users were skipped</DialogTitle>
          </DialogHeader>
          <ul className="max-h-64 space-y-1.5 overflow-auto text-sm">
            {(failures ?? []).map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.label}</span>{" "}
                <span className="text-destructive">- {f.error}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" onClick={() => setFailures(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
