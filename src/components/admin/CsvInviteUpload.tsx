import { useState, useMemo, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Upload, ArrowLeft, ArrowRight, FileText, Check, X } from "lucide-react";
import type { Role } from "@/lib/shift-log";
import type { AdminPlant } from "@/lib/shift-log";
import type { InviteResult } from "./UserInviteForm";

const ROLES: { value: Role; label: string; description: string }[] = [
  { value: "operator", label: "Operator", description: "Log events and observations" },
  { value: "technician", label: "Technician", description: "Log and resolve maintenance events" },
  { value: "supervisor", label: "Supervisor", description: "Oversee shifts and approve events" },
  { value: "shift_manager", label: "Shift Manager", description: "Manage shift operations" },
  { value: "plant_manager", label: "Plant Manager", description: "Full plant oversight" },
  { value: "integration_admin", label: "Integration Admin", description: "Manage data connectors" },
  { value: "system_admin", label: "System Admin", description: "Full system access" },
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCsvEmails(text: string): string[] {
  const lines = text
    .split(/[,\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const first = lines[0]?.toLowerCase() ?? "";
  const startIdx = first === "email" || first === "emails" || first === "email address" ? 1 : 0;
  return [
    ...new Set(
      lines
        .slice(startIdx)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes("@")),
    ),
  ];
}

type Step = "upload" | "preview" | "progress";

export function CsvInviteUpload({
  plants,
  onInvite,
  onComplete,
}: {
  plants: AdminPlant[];
  onInvite: (data: { email: string; role: Role; plant_ids: string[] }) => Promise<InviteResult>;
  onComplete?: (results: InviteResult[]) => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [batchName, setBatchName] = useState("");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("operator");
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    done: number;
    results: InviteResult[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsedEmails = useMemo(() => parseCsvEmails(rawText), [rawText]);
  const validEmails = useMemo(() => parsedEmails.filter(isValidEmail), [parsedEmails]);
  const invalidEmails = useMemo(() => parsedEmails.filter((e) => !isValidEmail(e)), [parsedEmails]);

  const togglePlant = (plantId: string) => {
    setSelectedPlants((prev) =>
      prev.includes(plantId) ? prev.filter((id) => id !== plantId) : [...prev, plantId],
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") setRawText(text);
    };
    reader.readAsText(file);
  };

  const handleSend = async () => {
    if (validEmails.length === 0 || sending) return;
    setSending(true);
    setStep("progress");
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

  const reset = () => {
    setStep("upload");
    setBatchName("");
    setRawText("");
    setFileName(null);
    setRole("operator");
    setSelectedPlants([]);
    setSending(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const done = progress?.done ?? 0;
  const total = progress?.total ?? 0;
  const succeeded = progress?.results.filter((r) => r.ok).length ?? 0;
  const failed = progress?.results.filter((r) => !r.ok).length ?? 0;

  /* ------------------------------------------------------------------ */
  /*  Step 1: Upload                                                     */
  /* ------------------------------------------------------------------ */
  if (step === "upload") {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="batch-name">Batch name</Label>
          <Input
            id="batch-name"
            placeholder="e.g. Q3 Onboarding"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A label for your reference (not sent to users)
          </p>
        </div>

        <div>
          <Label>Upload CSV</Label>
          <div className="mt-1 flex items-center gap-3">
            <label
              htmlFor="csv-file"
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:bg-secondary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            >
              <Upload className="h-4 w-4" />
              {fileName ?? "Choose file"}
              <input
                ref={fileRef}
                id="csv-file"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            {fileName && (
              <button
                type="button"
                aria-label={`Remove selected file ${fileName}`}
                onClick={() => {
                  setFileName(null);
                  setRawText("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            One email per line or comma-separated. Header row (email, Email, etc.) is auto-skipped.
          </p>
        </div>

        {parsedEmails.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
            <p>
              Parsed <span className="font-medium text-primary">{validEmails.length} valid</span>
              {invalidEmails.length > 0 && (
                <>
                  ,{" "}
                  <span className="font-medium text-destructive">
                    {invalidEmails.length} invalid
                  </span>
                </>
              )}
            </p>
            {invalidEmails.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
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
        )}

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
                  name="csv-role"
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

        <button
          type="button"
          onClick={() => validEmails.length > 0 && setStep("preview")}
          disabled={validEmails.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Preview {validEmails.length} email{validEmails.length !== 1 ? "s" : ""}{" "}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Step 2: Preview                                                    */
  /* ------------------------------------------------------------------ */
  if (step === "preview") {
    const previewEmails = validEmails.slice(0, 25);
    const remaining = validEmails.length - previewEmails.length;
    const roleLabel = ROLES.find((r) => r.value === role)?.label ?? role;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">
              {batchName || "CSV Import"}{" "}
              <span className="font-normal text-muted-foreground">
                ({validEmails.length} invite{validEmails.length !== 1 ? "s" : ""})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Role: {roleLabel}
              {selectedPlants.length > 0 &&
                ` · ${selectedPlants.length} plant${selectedPlants.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>

        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span>Email</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {previewEmails.map((email, i) => (
              <div
                key={email}
                className="grid grid-cols-[auto_1fr] gap-x-4 border-b border-border px-3 py-1.5 text-sm last:border-0"
              >
                <span className="text-xs text-muted-foreground">{i + 1}</span>
                <span>{email}</span>
              </div>
            ))}
          </div>
          {remaining > 0 && (
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              …and {remaining} more
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          Send {validEmails.length} invitation{validEmails.length !== 1 ? "s" : ""}
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Step 3: Progress                                                   */
  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{batchName || "CSV Import"} — Sending invitations…</h3>

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
          <div className="mt-3 flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium">
              {batchName || "Batch"} — {succeeded} sent
              {failed > 0 && <span className="text-destructive">, {failed} failed</span>}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-1 rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary"
            >
              Upload another CSV
            </button>
          </div>
        )}
        {progress && progress.results.filter((r) => !r.ok).length > 0 && (
          <ul className="mt-2 space-y-0.5">
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
    </div>
  );
}
