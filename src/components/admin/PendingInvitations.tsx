import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import type { Invitation } from "@/lib/shift-log";
import { useBulkRevokeInvitations, useRevokeInvitation } from "@/lib/admin-hooks";

interface PendingInvitationsProps {
  tenantId: string;
  invitations: Invitation[] | undefined;
  /** Rendered when there are no pending invitations (pages keep their own empty states). */
  empty?: React.ReactNode;
}

export function PendingInvitations({ tenantId, invitations, empty }: PendingInvitationsProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmIds, setConfirmIds] = useState<string[] | null>(null);
  const revoke = useRevokeInvitation(tenantId);
  const bulkRevoke = useBulkRevokeInvitations(tenantId);

  const pending = (invitations ?? []).filter((inv) => !inv.accepted);
  if (pending.length === 0) return <>{empty}</>;

  const pendingIds = pending.map((inv) => inv.id);
  const selectedCount = pendingIds.filter((id) => selected.has(id)).length;
  const allChecked = selectedCount === pendingIds.length;
  const pendingAction = revoke.isPending || bulkRevoke.isPending;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSelectAll = (checked: boolean) =>
    setSelected(checked ? new Set(pendingIds) : new Set());

  const handleSingle = async (id: string) => {
    try {
      await revoke.mutateAsync(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation");
    }
  };

  const handleBulk = async (idsToRevoke: string[]) => {
    try {
      const res = await bulkRevoke.mutateAsync(idsToRevoke);
      if (res.failed.length === 0) {
        toast.success(`Revoked ${res.revoked} invitation(s)`);
      } else {
        const detail = res.failed
          .slice(0, 3)
          .map((f) => {
            const inv = pending.find((i) => i.id === f.id);
            return `${inv?.email ?? f.id} - ${f.error}`;
          })
          .join(", ");
        toast.warning(`${res.revoked} revoked - ${res.failed.length} failed`, {
          description: detail,
        });
      }
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitations");
    } finally {
      setConfirmIds(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          aria-label="Select all pending invitations"
          checked={allChecked ? true : selectedCount > 0 ? "indeterminate" : false}
          onCheckedChange={(checked) => handleSelectAll(checked === true)}
          disabled={pendingAction}
        />
        <span className="text-xs text-muted-foreground">Select all pending</span>
      </div>

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card px-3 py-2">
          <span className="mr-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {bulkRevoke.isPending && (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            )}
            <span className="tabular-nums">{selectedCount}</span> selected
          </span>
          <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmIds(pendingIds.filter((id) => selected.has(id)))}
            disabled={pendingAction}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Revoke selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            disabled={pendingAction}
            aria-label="Clear selection"
            title="Clear selection"
            className="ml-auto px-2"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {pending.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <Checkbox
              aria-label={`Select invitation for ${inv.email}`}
              checked={selected.has(inv.id)}
              onCheckedChange={() => toggle(inv.id)}
              disabled={pendingAction}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{inv.email}</p>
              <p className="text-xs text-muted-foreground">
                {inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Revoke invitation for ${inv.email}`}
              onClick={() => handleSingle(inv.id)}
              disabled={pendingAction}
              className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Bulk revoke confirmation */}
      <AlertDialog
        open={confirmIds !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {(confirmIds ?? []).length} invitation(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite links stop working immediately; those addresses will need a new
              invitation. Targets:{" "}
              {pending
                .filter((i) => (confirmIds ?? []).includes(i.id))
                .slice(0, 5)
                .map((i) => i.email)
                .join(", ")}
              {(confirmIds ?? []).length > 5 ? " and more." : "."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleBulk(confirmIds ?? [])}
              disabled={pendingAction}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
