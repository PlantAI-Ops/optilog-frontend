import { useState } from "react";
import { Plus, CircleCheck, Loader2, Save, Trash2 } from "lucide-react";
import type { RCAAction } from "@/lib/hooks";
import { useCreateRCAAction, useCompleteRCAAction, useUpdateRCAAction } from "@/lib/hooks";

type ActionType = "corrective" | "preventive" | "verification" | "monitoring";

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: "corrective", label: "Corrective" },
  { value: "preventive", label: "Preventive" },
  { value: "verification", label: "Verification" },
  { value: "monitoring", label: "Monitoring" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  verification_required: "Verification Required",
  completed: "Completed",
  verified: "Verified",
  closed: "Closed",
};

interface RcaActionsCardProps {
  incidentId: string;
  actions: RCAAction[] | undefined;
}

interface AddActionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  formType: ActionType;
  setFormType: (v: ActionType) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formAssignee: string;
  setFormAssignee: (v: string) => void;
  formDueDate: string;
  setFormDueDate: (v: string) => void;
  isPending: boolean;
}

export function RcaActionsCard({ incidentId, actions }: RcaActionsCardProps) {
  const [openAdd, setOpenAdd] = useState(false);
  const [formType, setFormType] = useState<ActionType>("corrective");
  const [formDescription, setFormDescription] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  const createAction = useCreateRCAAction();
  const completeAction = useCompleteRCAAction();
  const updateAction = useUpdateRCAAction();

  const actionList = actions ?? [];

  const handleCreate = async () => {
    if (!formDescription.trim()) return;
    setOpenAdd(false);
    try {
      await createAction.mutateAsync({
        incidentId,
        data: {
          type: formType,
          description: formDescription,
          ...(formAssignee ? { assigned_to: formAssignee } : {}),
          ...(formDueDate ? { due_date: formDueDate } : {}),
        },
      });
      setFormType("corrective");
      setFormDescription("");
      setFormAssignee("");
      setFormDueDate("");
    } catch {
      /* error shown via toast or inline */
    }
  };

  const handleComplete = async (action: RCAAction) => {
    try {
      await completeAction.mutateAsync(action.id);
    } catch {
      /* error handling */
    }
  };

  const handleStatusChange = async (action: RCAAction, newStatus: string) => {
    try {
      await updateAction.mutateAsync({
        actionId: action.id,
        patch: { status: newStatus },
      });
    } catch {
      /* error handling */
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "verified":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-primary/10 text-primary border-primary/20";
      case "assigned":
        return "bg-warning/10 text-warning border-warning/20";
      case "pending":
        return "bg-secondary/10 text-muted-foreground border-border";
      default:
        return "bg-secondary/10 text-muted-foreground border-border";
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Structured Actions</h2>
        <button
          type="button"
          onClick={() => setOpenAdd(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary/60"
        >
          <Plus className="size-3" /> Add Action
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {actionList.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No actions defined yet.
          </div>
        ) : (
          actionList.map((action) => (
            <div
              key={action.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold">{action.ref ?? action.id.slice(-4)}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(action.status)}`}
                  >
                    {STATUS_LABEL[action.status] ?? action.status}
                  </span>
                </div>
                <p className="text-sm">{action.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {action.assigned_to_name
                    ? `Assigned to: ${action.assigned_to_name}`
                    : "Unassigned"}
                  {action.due_date ? ` · Due: ${action.due_date}` : ""}
                  {action.type ? ` · ${action.type}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {action.status !== "completed" && action.status !== "verified" ? (
                  <button
                    type="button"
                    onClick={() => handleComplete(action)}
                    disabled={completeAction.isPending}
                    className="flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-xs font-semibold text-success-foreground disabled:opacity-60"
                  >
                    {completeAction.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CircleCheck className="size-3.5" />
                    )}
                    Complete
                  </button>
                ) : (
                  <span className="text-xs text-success">Completed</span>
                )}
                <button
                  type="button"
                  onClick={() => handleStatusChange(action, "closed")}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {openAdd && (
        <AddActionDialog
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          onSave={handleCreate}
          formType={formType}
          setFormType={setFormType}
          formDescription={formDescription}
          setFormDescription={setFormDescription}
          formAssignee={formAssignee}
          setFormAssignee={setFormAssignee}
          formDueDate={formDueDate}
          setFormDueDate={setFormDueDate}
          isPending={createAction.isPending}
        />
      )}
    </div>
  );
}

function AddActionDialog({
  open,
  onClose,
  onSave,
  formType,
  setFormType,
  formDescription,
  setFormDescription,
  formAssignee,
  setFormAssignee,
  formDueDate,
  setFormDueDate,
  isPending,
}: AddActionDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 z-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-card rounded-xl border border-border p-6 w-full max-w-md shadow-lg">
        <h3 className="text-sm font-semibold mb-4">Add Action</h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Type
            </label>
            <div className="flex gap-2">
              {ACTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFormType(t.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-all ${
                    formType === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What needs to be done?"
              className="rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
              rows={3}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assigned To (user ID)
              </label>
              <input
                value={formAssignee}
                onChange={(e) => setFormAssignee(e.target.value)}
                placeholder="User ID"
                className="rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Due Date
              </label>
              <input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                className="rounded border border-input bg-secondary px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
