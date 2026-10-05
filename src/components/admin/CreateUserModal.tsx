import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Role, Tenant } from "@/lib/shift-log";
import { useShiftLog, hasMinRole } from "@/lib/shift-log";
import { useCreateSystemUser, useTenants, useTenant, useInviteUser, useTenantPlants } from "@/lib/admin-hooks";

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When set, the tenant select is locked to this tenant (tenant admin panel). */
  tenantId?: string;
}

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "operator", label: "Operator", description: "Floor capture only" },
  { value: "technician", label: "Technician", description: "Maintenance tasks" },
  { value: "supervisor", label: "Supervisor", description: "Shift oversight" },
  { value: "shift_manager", label: "Shift Manager", description: "Shift scheduling" },
  { value: "plant_manager", label: "Plant Manager", description: "Plant admin" },
  { value: "integration_admin", label: "Integration Admin", description: "Integrations config" },
  // system_admin excluded - cannot grant via this UI
];

export function CreateUserModal({ open, onOpenChange, onSuccess, tenantId }: CreateUserModalProps) {
  const caller = useShiftLog().user;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [plantIds, setPlantIds] = useState<string[]>([]);
  const [sendInvitation, setSendInvitation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tenantLocked = !!tenantId;
  const effectiveTenantId = tenantId ?? selectedTenantId;
  // Callers may only grant roles at or below their own rank.
  const roleOptions = ROLE_OPTIONS.filter((r) => caller && hasMinRole(caller.role, r.value));

  const createUser = useCreateSystemUser();
  const tenants = useTenants(!tenantLocked);
  const lockedTenant = useTenant(tenantId);
  const inviteUser = useInviteUser(effectiveTenantId);
  const plantsQuery = useTenantPlants(open && effectiveTenantId ? effectiveTenantId : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      if (sendInvitation) {
        if (!effectiveTenantId) {
          throw new Error("Select a tenant before sending an invitation");
        }
        await inviteUser.mutateAsync({
          email: email.trim(),
          role,
          plant_ids: plantIds,
        });
      } else {
        if (password.trim().length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
        await createUser.mutateAsync({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          tenant_id: effectiveTenantId,
          plant_ids: plantIds,
        });
      }
      onSuccess();
      onOpenChange(false);
      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setRole("operator");
      setSelectedTenantId("");
      setPlantIds([]);
      setSendInvitation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="create-name">Name</Label>
            <Input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="create-password">Password</Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!sendInvitation}
              disabled={loading || sendInvitation}
              placeholder={sendInvitation ? "Not needed - invitation email will be sent" : "Min 8 characters"}
            />
            <p className="text-xs text-muted-foreground">
              {sendInvitation ? "User will set password via invitation link" : "Required for direct creation"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value: string) => setRole(value as Role)} disabled={loading}>
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
            </div>

            {tenantLocked ? (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <p className="text-sm text-muted-foreground">
                  {lockedTenant.data?.name ?? "This workspace"}
                  <span className="ml-1 text-xs">— new members are added here</span>
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select
                  value={selectedTenantId}
                  onValueChange={(value: string) => {
                    setSelectedTenantId(value);
                    // Plant list is tenant-scoped — reset selections on change.
                    setPlantIds([]);
                  }}
                  disabled={loading}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.data?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          <div className="space-y-2">
            <Label>Plant Access</Label>
            <p className="text-xs text-muted-foreground">Select plants this user can access (optional)</p>
            {!effectiveTenantId ? (
              <p className="text-xs text-muted-foreground">Select a tenant to choose plants</p>
            ) : plantsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading plants...</p>
            ) : (plantsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No plants in this tenant yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(plantsQuery.data ?? []).map((p) => {
                  const selected = plantIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setPlantIds(
                          selected
                            ? plantIds.filter((id) => id !== p.id)
                            : [...plantIds, p.id],
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
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="create-invitation"
              checked={sendInvitation}
              onCheckedChange={(checked: boolean) => setSendInvitation(checked)}
              disabled={loading}
            />
            <div className="pt-1">
              <Label htmlFor="create-invitation" className="text-sm font-medium cursor-pointer">
                Send invitation email
              </Label>
              <p className="text-xs text-muted-foreground">
                User receives email to set password and complete setup. Uncheck to create active user immediately.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}