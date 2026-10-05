import { useState, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { Role } from "@/lib/shift-log";
import type { AdminPlant } from "@/lib/shift-log";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "operator", label: "Operator", description: "Log events and observations" },
  { value: "technician", label: "Technician", description: "Log and resolve maintenance events" },
  { value: "supervisor", label: "Supervisor", description: "Oversee shifts and approve events" },
  { value: "shift_manager", label: "Shift Manager", description: "Manage shift operations" },
  { value: "plant_manager", label: "Plant Manager", description: "Full plant oversight" },
  { value: "integration_admin", label: "Integration Admin", description: "Manage data connectors" },
  { value: "system_admin", label: "System Admin", description: "Full system access" },
];

function parseEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@")),
    ),
  ];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type InviteResult = { email: string; ok: boolean; error?: string };

export function UserInviteForm({
  plants,
  onInvite,
  onComplete,
}: {
  plants: AdminPlant[];
  onInvite: (data: { email: string; role: Role; plant_ids: string[] }) => Promise<InviteResult>;
  onComplete?: (results: InviteResult[]) => void;
}) {
  const [emailsRaw, setEmailsRaw] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    results: InviteResult[];
  } | null>(null);

  const parsedEmails = useMemo(() => parseEmails(emailsRaw), [emailsRaw]);
  const validEmails = useMemo(() => parsedEmails.filter(isValidEmail), [parsedEmails]);
  const invalidEmails = useMemo(() => parsedEmails.filter((e) => !isValidEmail(e)), [parsedEmails]);

  const togglePlant = (plantId: string) => {
    setSelectedPlants((prev) =>
      prev.includes(plantId) ? prev.filter((id) => id !== plantId) : [...prev, plantId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validEmails.length === 0 || sending) return;

    setSending(true);
    const results: InviteResult[] = [];
    setProgress({ total: validEmails.length, done: 0, results: [] });

    for (const email of validEmails) {
      const result = await onInvite({ email, role, plant_ids: selectedPlants });
      results.push(result);
      setProgress({ total: validEmails.length, done: results.length, results: [...results] });
    }

    setSending(false);
    onComplete?.(results);
  };

  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const succeeded = progress?.results.filter((r) => r.ok).length ?? 0;
  const failed = progress?.results.filter((r) => !r.ok).length ?? 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="invite-emails">Email addresses</Label>
        <textarea
          id="invite-emails"
          placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          rows={4}
          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">Comma or newline separated</p>
        {parsedEmails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {validEmails.map((e) => (
              <span key={e} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {e}
              </span>
            ))}
            {invalidEmails.map((e) => (
              <span
                key={e}
                className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive line-through"
              >
                {e}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>Role</Label>
        <div className="mt-2 space-y-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                role === r.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={r.value}
                checked={role === r.value}
                onChange={() => setRole(r.value)}
                className="accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {plants.length > 0 && (
        <div>
          <Label>Assign to plants</Label>
          <div className="mt-2 space-y-2">
            {plants.map((plant) => (
              <label
                key={plant.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/50"
              >
                <Checkbox
                  checked={selectedPlants.includes(plant.id)}
                  onCheckedChange={() => togglePlant(plant.id)}
                />
                <div>
                  <p className="text-sm font-medium">{plant.name}</p>
                  {plant.location && (
                    <p className="text-xs text-muted-foreground">{plant.location}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-border bg-secondary/50 p-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <div
              role="progressbar"
              aria-label="Invitation progress"
              aria-valuemin={0}
              aria-valuemax={Math.max(total, 1)}
              aria-valuenow={done}
              aria-valuetext={`${done} of ${total} invitations sent`}
              className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {done}/{total}
            </span>
          </div>
          {done === total && (
            <p className="mt-2 text-xs">
              {succeeded > 0 && <span className="text-primary">{succeeded} sent</span>}
              {succeeded > 0 && failed > 0 && <span className="text-muted-foreground"> · </span>}
              {failed > 0 && <span className="text-destructive">{failed} failed</span>}
            </p>
          )}
          {progress.results.filter((r) => !r.ok).length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {progress.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.email} className="text-xs text-destructive">
                    {r.email}: {r.error ?? "unknown error"}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={sending || validEmails.length === 0}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {sending
          ? `Sending ${total} invitation${total !== 1 ? "s" : ""}...`
          : validEmails.length > 0
            ? `Send ${validEmails.length} invitation${validEmails.length !== 1 ? "s" : ""}`
            : "Enter at least one email"}
      </button>
    </form>
  );
}
