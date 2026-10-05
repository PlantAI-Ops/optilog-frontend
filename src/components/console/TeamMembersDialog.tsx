import { useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canBeTeamMember, useShiftLog, hasMinRole } from "@/lib/shift-log";
import {
  inPlantScope,
  usePlantTeamsDetail,
  useUserDirectory,
  useSetTeamMembers,
  type TeamDetail,
} from "@/lib/hooks";

interface TeamMembersDialogProps {
  team: TeamDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shared supervisor interface for team membership: view the roster (any role),
 * add/remove members (supervisor+). Full-replace save via POST /teams/{id}/members.
 * Used by the Teams page and the Schedule page shift detail.
 */
export function TeamMembersDialog({ team, open, onOpenChange }: TeamMembersDialogProps) {
  const user = useShiftLog().user;
  const canManage = !!user && hasMinRole(user.role, "supervisor");
  const plantId = user?.plant_ids?.[0];

  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamsDetail = usePlantTeamsDetail(plantId);
  const directory = useUserDirectory(user?.tenant_id, canManage && open);
  const setTeamMembers = useSetTeamMembers();

  useEffect(() => {
    if (open) {
      setSearch("");
      setAdding(false);
      setError(null);
    }
  }, [open, team?.id]);

  if (!team) return null;

  // Prefer the freshest team doc (membership mutations invalidate this query).
  const detail = teamsDetail.data?.find((t) => t.id === team.id) ?? team;
  const memberIds = detail.member_ids ?? detail.members?.map((m) => m.id) ?? [];
  const members = detail.members;

  const candidates = (directory.data ?? []).filter(
    (u) =>
      u.active &&
      // Plant managers+ never belong to a crew.
      canBeTeamMember(u.role) &&
      !memberIds.includes(u.id) &&
      // Same scope as the Layout board: this plant's people plus tenant
      // users who have no plant yet.
      inPlantScope(u, plantId) &&
      (search.trim() === "" ||
        u.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        u.email.toLowerCase().includes(search.trim().toLowerCase())),
  );

  const save = async (nextIds: string[]) => {
    setError(null);
    try {
      await setTeamMembers.mutateAsync({ teamId: team.id, memberIds: nextIds });
      setAdding(false);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update members");
    }
  };

  const pending = setTeamMembers.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{team.name} — Members</DialogTitle>
          <DialogDescription>
            {canManage
              ? "Add or remove people assigned to this team."
              : "People assigned to this team."}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {members?.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5"
            >
              <span className={`min-w-0 truncate text-sm ${m.active ? "" : "opacity-60"}`}>
                {m.name} <span className="text-xs text-muted-foreground">· {m.email}</span>
                {!m.active ? (
                  <span className="ml-1.5 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    inactive
                  </span>
                ) : null}
              </span>
              {canManage ? (
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  disabled={pending}
                  onClick={() => save(memberIds.filter((id) => id !== m.id))}
                  className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive disabled:opacity-50"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
          {!members && memberIds.length > 0 ? (
            <li className="px-1 py-1.5 text-sm text-muted-foreground">
              {memberIds.length} member{memberIds.length === 1 ? "" : "s"}
              {teamsDetail.isLoading ? (
                <Loader2 className="ml-2 inline size-3 animate-spin" />
              ) : null}
            </li>
          ) : null}
          {memberIds.length === 0 && !teamsDetail.isLoading ? (
            <li className="px-1 py-1.5 text-sm text-muted-foreground">No members yet.</li>
          ) : null}
        </ul>

        {canManage ? (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              onClick={() => setAdding((v) => !v)}
            >
              <UserPlus className="size-4" />
              {adding ? "Close" : "Add member"}
            </button>

            {adding ? (
              <div className="mt-3">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  autoFocus
                  className="h-9 w-full rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus:border-ring"
                />
                <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                  {candidates.slice(0, 12).map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => save([...memberIds, u.id])}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{u.name}</span>{" "}
                          <span className="text-muted-foreground">{u.email}</span>
                        </span>
                        <span className="ml-2 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {u.role}
                        </span>
                      </button>
                    </li>
                  ))}
                  {!directory.isLoading && candidates.length === 0 ? (
                    <li className="px-2 py-2 text-sm text-muted-foreground">
                      No matching users to add.
                    </li>
                  ) : null}
                  {directory.isLoading ? (
                    <li className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading users…
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canManage ? (
          <p className="text-xs text-muted-foreground">
            One team per user — assigning someone here removes them from any other team.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
