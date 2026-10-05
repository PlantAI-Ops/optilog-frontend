import { Fragment, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Loader2, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyPlantState } from "@/components/console/EmptyPlantState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  inPlantScope,
  useCreateTeam,
  usePlantLinesByArea,
  usePlantTeamsDetail,
  useSetTeamMembers,
  useUpdateTeam,
  useUserDirectory,
  type AreaLineGroup,
  type DirectoryUser,
  type Line,
  type TeamDetail,
} from "@/lib/hooks";
import { hasMinRole, useShiftLog } from "@/lib/shift-log";

type MemberDragData = {
  kind: "member";
  teamId: string | null;
  userId: string;
  instance: string;
  label: string;
};

type TeamDragData = {
  kind: "team";
  teamId: string;
  instance: string;
  label: string;
};

type ActiveData = MemberDragData | TeamDragData;

type OverData = {
  kind?: "member" | "team" | "line" | "pool" | "tray";
  teamId?: string | null;
  userId?: string;
  lineId?: string;
  instance?: string;
};

const memberIdsOf = (team: TeamDetail): string[] =>
  team.member_ids ?? team.members?.map((m) => m.id) ?? [];

const sortTeams = (list: TeamDetail[]): TeamDetail[] =>
  [...list].sort(
    (a, b) =>
      (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  );

const sameIds = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

const shiftTypeLabel = (cfg?: Record<string, unknown>): string | null => {
  const raw = cfg?.["type"];
  const type = typeof raw === "string" ? raw : null;
  if (!type) return null;
  const labels: Record<string, string> = {
    regular_day: "Regular day",
    extended_day: "Extended day",
    night: "Night",
    rotating: "Rotating",
  };
  return labels[type] ?? type.replace(/_/g, " ");
};

interface MemberChipProps {
  userId: string;
  name: string;
  teamId: string;
  instance: string;
  canManage: boolean;
  onRemove: () => void;
}

function MemberChip({ userId, name, teamId, instance, canManage, onRemove }: MemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `m:${instance}:${userId}`,
    data: { kind: "member", teamId, userId, instance, label: name } satisfies MemberDragData,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      title={name}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border bg-secondary px-2 py-1.5 text-xs",
        canManage && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <span className="min-w-0 truncate font-medium">{name}</span>
      {canManage ? (
        <button
          type="button"
          aria-label={`Remove ${name} from team`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

function PoolChip({ user, canManage }: { user: DirectoryUser; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `m:pool:${user.id}`,
    data: {
      kind: "member",
      teamId: null,
      userId: user.id,
      instance: "pool",
      label: user.name,
    } satisfies MemberDragData,
    disabled: !canManage,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs",
        canManage && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      title={`${user.name} · ${user.email}`}
    >
      <span className="min-w-0 truncate font-medium">{user.name}</span>
      <span className="shrink-0 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {user.role.replace(/_/g, " ")}
      </span>
    </div>
  );
}

interface TeamCardProps {
  team: TeamDetail;
  instance: string;
  canManage: boolean;
  allLineIds: string[];
  groups: AreaLineGroup[];
  nameFor: (userId: string) => string;
  onAllLines: () => void;
  onCoverage: (ids: string[]) => void;
  onRemovePlacement: () => void;
  onRemoveMember: (userId: string) => void;
}

function TeamCard({
  team,
  instance,
  canManage,
  allLineIds,
  groups,
  nameFor,
  onAllLines,
  onCoverage,
  onRemovePlacement,
  onRemoveMember,
}: TeamCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `t:${instance}:${team.id}`,
    data: { kind: "team", teamId: team.id, instance, label: team.name } satisfies TeamDragData,
    disabled: !canManage,
  });
  const [linesOpen, setLinesOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);

  const ids = memberIdsOf(team);
  const coverage = team.assigned_line_ids ?? [];
  const placed = coverage.length > 0;
  const coversAll =
    placed && allLineIds.length > 0 && allLineIds.every((id) => coverage.includes(id));
  const lineById = new Map(groups.flatMap((g) => g.lines).map((l) => [l.id, l]));
  const coverageLabel = !placed
    ? "No line"
    : coversAll
      ? "All lines"
      : `${lineById.get(coverage[0] ?? "") ?? "Line"}${coverage.length > 1 ? ` +${coverage.length - 1}` : ""}`;
  const shiftLabel = shiftTypeLabel(team.shift_config);

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-xl border bg-card p-3", isDragging && "opacity-40")}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className={cn(
            "flex min-w-0 items-center gap-1.5",
            canManage && "cursor-grab active:cursor-grabbing",
          )}
        >
          <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
          <h3 className="truncate text-sm font-semibold">{team.name}</h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            placed
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground",
          )}
        >
          {coverageLabel}
        </span>
      </div>

      <p className="mt-1 truncate text-xs text-muted-foreground">
        {team.supervisor_name ? `Supervisor ${team.supervisor_name}` : "No supervisor"} ·{" "}
        {ids.length} member{ids.length === 1 ? "" : "s"}
        {shiftLabel ? ` · ${shiftLabel}` : ""}
      </p>

      <ul className="mt-2 space-y-1.5">
        <SortableContext
          items={ids.map((uid) => `m:${instance}:${uid}`)}
          strategy={verticalListSortingStrategy}
        >
          {ids.map((uid) => (
            <li key={uid}>
              <MemberChip
                userId={uid}
                name={nameFor(uid)}
                teamId={team.id}
                instance={instance}
                canManage={canManage}
                onRemove={() => onRemoveMember(uid)}
              />
            </li>
          ))}
        </SortableContext>
        {ids.length === 0 ? (
          <li className="rounded-lg border border-dashed px-2 py-2 text-center text-[11px] text-muted-foreground">
            {canManage ? "Drag people here from Unassigned" : "No members yet"}
          </li>
        ) : null}
      </ul>

      {canManage ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border pt-2.5">
          {!coversAll && allLineIds.length > 0 ? (
            <button
              type="button"
              onClick={onAllLines}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-secondary"
            >
              All lines
            </button>
          ) : null}
          <Popover
            open={linesOpen}
            onOpenChange={(open) => {
              if (open) setChecked([...coverage]);
              setLinesOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-secondary"
              >
                Lines…
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-3">
              <p className="mb-2 text-xs font-semibold">Place {team.name} on</p>
              {groups
                .flatMap((g) => g.lines)
                .map((line) => (
                  <label
                    key={line.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-secondary"
                  >
                    <Checkbox
                      checked={checked.includes(line.id)}
                      onCheckedChange={(v) =>
                        setChecked((prev) =>
                          v === true ? [...prev, line.id] : prev.filter((id) => id !== line.id),
                        )
                      }
                    />
                    <span>{line.name}</span>
                  </label>
                ))}
              <div className="flex justify-end gap-1.5 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => setLinesOpen(false)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCoverage(checked);
                    setLinesOpen(false);
                  }}
                  className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Apply
                </button>
              </div>
            </PopoverContent>
          </Popover>
          {placed ? (
            <button
              type="button"
              onClick={onRemovePlacement}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-secondary"
            >
              Remove placement
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function LineColumn({
  line,
  teams,
  canManage,
  areaName,
  renderCard,
}: {
  line: Line;
  teams: TeamDetail[];
  canManage: boolean;
  areaName?: string | undefined;
  renderCard: (team: TeamDetail) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `line:${line.id}`,
    data: { kind: "line", lineId: line.id } satisfies OverData,
  });
  return (
    <div className="w-72 shrink-0">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {line.name}
          </h3>
          {areaName ? (
            <p className="truncate text-[10px] text-muted-foreground">{areaName}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {teams.length} team{teams.length === 1 ? "" : "s"}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-40 rounded-xl border border-dashed bg-muted/30 p-2 transition-colors",
          isOver && "border-primary bg-primary/5 ring-1 ring-primary",
        )}
      >
        <SortableContext
          items={teams.map((t) => `t:${line.id}:${t.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">{teams.map((t) => renderCard(t))}</div>
        </SortableContext>
        {teams.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {canManage ? "Drag a team here" : "No teams"}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function LayoutBoard() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const canManage = !!user && hasMinRole(user.role, "supervisor");

  const structureQ = usePlantLinesByArea(plantId);
  const teamsQ = usePlantTeamsDetail(plantId);
  const directory = useUserDirectory(user?.tenant_id, canManage);

  const updateTeam = useUpdateTeam();
  const setTeamMembers = useSetTeamMembers();
  const createTeam = useCreateTeam();

  const [boardError, setBoardError] = useState<string | null>(null);
  const [dragItem, setDragItem] = useState<{
    kind: "member" | "team";
    label: string;
    sub?: string;
  } | null>(null);
  const [newTeamOpen, setNewTeamOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamPending, setNewTeamPending] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { setNodeRef: trayRef, isOver: trayIsOver } = useDroppable({
    id: "tray",
    data: { kind: "tray" } satisfies OverData,
  });
  const { setNodeRef: poolRef, isOver: poolIsOver } = useDroppable({
    id: "pool",
    data: { kind: "pool" } satisfies OverData,
  });

  const groups = structureQ.data ?? [];
  const lines = groups.flatMap((g) => g.lines);
  const teams = teamsQ.data ?? [];
  const allLineIds = lines.map((l) => l.id);
  const areaNameById = new Map(groups.map((g) => [g.area.id, g.area.name]));
  const multiArea = new Set(lines.map((l) => l.area_id)).size > 1;

  const byId = (id: string) => teams.find((t) => t.id === id);
  const unplaced = sortTeams(teams.filter((t) => !t.assigned_line_ids?.length));
  const teamsOnLine = (lineId: string) =>
    sortTeams(teams.filter((t) => t.assigned_line_ids?.includes(lineId)));

  const assignedIds = new Set(teams.flatMap((t) => memberIdsOf(t)));
  const activeUsers = (directory.data ?? []).filter((u) => u.active && !assignedIds.has(u.id));
  const poolUsers = activeUsers.filter((u) => inPlantScope(u, plantId));
  const poolQ = poolSearch.trim().toLowerCase();
  const filteredPool = poolQ
    ? poolUsers.filter((u) =>
        [u.name, u.email, u.role].some((v) => v.toLowerCase().includes(poolQ)),
      )
    : poolUsers;
  const nameMap = new Map((directory.data ?? []).map((u) => [u.id, u.name]));
  const nameFor = (userId: string, team?: TeamDetail): string =>
    team?.members?.find((m) => m.id === userId)?.name ??
    nameMap.get(userId) ??
    `${userId.slice(0, 6)}…`;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBoardError(null);
    try {
      await fn();
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : fallback);
    }
  };

  const setCoverage = (team: TeamDetail, ids: string[]) =>
    run(
      () => updateTeam.mutateAsync({ teamId: team.id, patch: { assigned_line_ids: ids } }),
      "Failed to update placement",
    );

  const unplaceTeam = (team: TeamDetail) => setCoverage(team, []);

  const placeAllLines = (team: TeamDetail) => {
    if (allLineIds.length > 0) setCoverage(team, allLineIds);
  };

  const addMember = (team: TeamDetail, userId: string) => {
    const ids = memberIdsOf(team);
    if (ids.includes(userId)) return;
    run(
      () => setTeamMembers.mutateAsync({ teamId: team.id, memberIds: [...ids, userId] }),
      "Failed to add member",
    );
  };

  const removeMember = (team: TeamDetail, userId: string) =>
    run(
      () =>
        setTeamMembers.mutateAsync({
          teamId: team.id,
          memberIds: memberIdsOf(team).filter((id) => id !== userId),
        }),
      "Failed to remove member",
    );

  const reorderMembers = (team: TeamDetail, next: string[]) =>
    run(
      () => setTeamMembers.mutateAsync({ teamId: team.id, memberIds: next }),
      "Failed to reorder members",
    );

  const reorderTeamCards = async (instance: string, fromTeamId: string, toTeamId: string) => {
    const list = instance === "tray" ? unplaced : teamsOnLine(instance);
    const ordered = sortTeams(list);
    const from = ordered.findIndex((t) => t.id === fromTeamId);
    const to = ordered.findIndex((t) => t.id === toTeamId);
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(ordered, from, to);
    for (let i = 0; i < next.length; i++) {
      const t = next[i];
      if (!t) continue;
      if ((t.sort_order ?? Number.MAX_SAFE_INTEGER) !== i) {
        await run(
          () => updateTeam.mutateAsync({ teamId: t.id, patch: { sort_order: i } }),
          "Failed to reorder teams",
        );
      }
    }
  };

  const submitNewTeam = async () => {
    const name = newTeamName.trim();
    if (!name || !plantId) return;
    setNewTeamPending(true);
    await run(async () => {
      await createTeam.mutateAsync({ plantId, name });
      setNewTeamOpen(false);
      setNewTeamName("");
    }, "Failed to create team");
    setNewTeamPending(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const d = event.active.data.current as ActiveData | undefined;
    if (!d) return;
    if (d.kind === "member") {
      setDragItem({ kind: "member", label: d.label });
    } else {
      const team = byId(d.teamId);
      const coverage = team?.assigned_line_ids ?? [];
      setDragItem({
        kind: "team",
        label: d.label,
        sub: coverage.length
          ? `On ${coverage.length} line${coverage.length === 1 ? "" : "s"}`
          : "Unplaced",
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragItem(null);
    const { active, over } = event;
    if (!over) return;
    const aData = active.data.current as ActiveData | undefined;
    const oData = over.data.current as OverData | undefined;
    if (!aData || !oData) return;

    if (aData.kind === "member") {
      if (oData.kind === "pool") {
        if (aData.teamId) {
          const team = byId(aData.teamId);
          if (team) removeMember(team, aData.userId);
        }
        return;
      }
      if (oData.kind === "team" && oData.teamId) {
        const target = byId(oData.teamId);
        if (target && target.id !== aData.teamId) addMember(target, aData.userId);
        return;
      }
      if (oData.kind === "member" && oData.userId) {
        if (aData.teamId && oData.teamId === aData.teamId) {
          const team = byId(aData.teamId);
          if (team) {
            const ids = memberIdsOf(team);
            const from = ids.indexOf(aData.userId);
            const to = ids.indexOf(oData.userId);
            if (from >= 0 && to >= 0 && from !== to) {
              reorderMembers(team, arrayMove(ids, from, to));
            }
          }
          return;
        }
        if (!aData.teamId && oData.teamId) {
          const target = byId(oData.teamId);
          if (target) addMember(target, aData.userId);
        }
        return;
      }
      return;
    }

    const team = byId(aData.teamId);
    if (!team) return;
    const current = team.assigned_line_ids ?? [];
    const source = aData.instance === "tray" ? null : aData.instance;

    if (oData.kind === "line" && oData.lineId) {
      const next = current.filter((id) => id !== source);
      if (!next.includes(oData.lineId)) next.push(oData.lineId);
      if (!sameIds(next, current)) setCoverage(team, next);
      return;
    }
    if (oData.kind === "tray") {
      if (source !== null && current.length > 0) unplaceTeam(team);
      return;
    }
    if (oData.kind === "team" && oData.teamId && oData.instance) {
      if (oData.instance === "tray") {
        if (source === null) void reorderTeamCards("tray", team.id, oData.teamId);
        else if (current.length > 0) unplaceTeam(team);
        return;
      }
      const targetLine = oData.instance;
      if (!current.includes(targetLine)) {
        const next = current.filter((id) => id !== source);
        if (!next.includes(targetLine)) next.push(targetLine);
        if (!sameIds(next, current)) setCoverage(team, next);
        return;
      }
      void reorderTeamCards(targetLine, team.id, oData.teamId);
    }
  };

  const renderCard = (team: TeamDetail, instance: string) => (
    <TeamCard
      key={`${instance}:${team.id}`}
      team={team}
      instance={instance}
      canManage={canManage}
      allLineIds={allLineIds}
      groups={groups}
      nameFor={(uid) => nameFor(uid, team)}
      onAllLines={() => placeAllLines(team)}
      onCoverage={(ids) => setCoverage(team, ids)}
      onRemovePlacement={() => unplaceTeam(team)}
      onRemoveMember={(uid) => removeMember(team, uid)}
    />
  );

  if (!plantId) {
    return <p className="text-sm text-muted-foreground">No plant is assigned to your account.</p>;
  }

  if (structureQ.isLoading || teamsQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const queryError = structureQ.error || teamsQ.error;
  if (queryError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive">
        Failed to load the layout. {queryError.message}
      </div>
    );
  }

  return (
    <DndContext
      sensors={canManage ? sensors : []}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragItem(null)}
    >
      <div className={cn("grid gap-6", canManage && "xl:grid-cols-[minmax(0,1fr)_18rem]")}>
        <div className="min-w-0 space-y-6">
          {boardError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive"
            >
              {boardError}
            </div>
          ) : null}

          {!canManage ? (
            <div className="rounded-xl border border-border bg-secondary p-3 text-sm text-muted-foreground">
              View only — supervisors can drag members and teams. Areas and lines come from the
              plant setup blueprint.
            </div>
          ) : null}

          <section ref={trayRef} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Unplaced teams</h2>
                <p className="text-xs text-muted-foreground">
                  Drag a team onto a line to place it.
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setNewTeamOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-3.5" />
                  New team
                </button>
              ) : null}
            </div>
            <div
              className={cn(
                "mt-3 min-h-28 rounded-lg border border-dashed p-3 transition-colors",
                trayIsOver && "border-primary bg-primary/5",
              )}
            >
              <SortableContext
                items={unplaced.map((t) => `t:tray:${t.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {unplaced.map((t) => renderCard(t, "tray"))}
                </div>
              </SortableContext>
              {unplaced.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {teams.length === 0
                    ? canManage
                      ? "No teams yet — create one to start building the layout."
                      : "No teams yet."
                    : "Every team is placed on at least one line."}
                </p>
              ) : null}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Plant structure</h2>
                <p className="text-xs text-muted-foreground">
                  Areas are zones along each line — place teams on the lines they staff. Blueprint
                  from onboarding: areas and lines are fixed here.
                </p>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {groups.length} zone{groups.length === 1 ? "" : "s"} · {lines.length} line
                {lines.length === 1 ? "" : "s"} · {teams.length} team
                {teams.length === 1 ? "" : "s"}
              </p>
            </div>
            {lines.length === 0 ? (
              <EmptyPlantState
                title="No areas or lines yet"
                description="The plant structure comes from the onboarding blueprint — areas (zones along the line) and lines. Configure the plant setup to build the layout; unplaced teams stay in the tray above."
              />
            ) : (
              <div className="space-y-3">
                {groups.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Zones along the line
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {groups.map((g, i) => (
                        <Fragment key={g.area.id}>
                          {i > 0 ? (
                            <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                          ) : null}
                          <span className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium">
                            <span className="tabular-nums text-muted-foreground">{i + 1}</span>
                            {g.area.name}
                          </span>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {lines.map((line) => (
                    <LineColumn
                      key={line.id}
                      line={line}
                      teams={teamsOnLine(line.id)}
                      canManage={canManage}
                      areaName={multiArea ? areaNameById.get(line.area_id) : undefined}
                      renderCard={(t) => renderCard(t, line.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {canManage ? (
          <section className="rounded-xl border border-border bg-card p-4 xl:sticky xl:top-24 xl:self-start">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Unassigned people</h2>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {poolQ && filteredPool.length !== poolUsers.length
                  ? `${filteredPool.length} / ${poolUsers.length}`
                  : `${poolUsers.length} available`}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag someone onto a team to assign them; drag them back here to unassign. Only people
              in this plant (or with no plant yet) are listed.
            </p>
            <input
              type="text"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              placeholder="Search by name, email, or role…"
              className="mt-3 h-9 w-full rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus:border-ring"
            />
            <div
              ref={poolRef}
              className={cn(
                "mt-3 min-h-12 max-h-[calc(100vh-14rem)] space-y-1.5 overflow-y-auto rounded-lg border border-dashed p-2 transition-colors",
                poolIsOver && "border-primary bg-primary/5",
              )}
            >
              {filteredPool.map((u) => (
                <PoolChip key={u.id} user={u} canManage={canManage} />
              ))}
              {filteredPool.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  {poolUsers.length === 0
                    ? directory.isLoading
                      ? "Loading people…"
                      : activeUsers.length > 0
                        ? "No unassigned people in this plant."
                        : "Everyone is assigned to a team."
                    : `No people match “${poolSearch.trim()}”.`}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <DragOverlay>
        {dragItem ? (
          dragItem.kind === "member" ? (
            <div className="rounded-lg border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium shadow-lg">
              {dragItem.label}
            </div>
          ) : (
            <div className="w-64 rounded-xl border border-primary/40 bg-card p-3 shadow-lg">
              <p className="truncate text-sm font-semibold">{dragItem.label}</p>
              {dragItem.sub ? (
                <p className="text-xs text-muted-foreground">{dragItem.sub}</p>
              ) : null}
            </div>
          )
        ) : null}
      </DragOverlay>

      <Dialog open={newTeamOpen} onOpenChange={setNewTeamOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New team</DialogTitle>
            <DialogDescription>
              Teams start unplaced — drag the card onto lines to place it.
            </DialogDescription>
          </DialogHeader>
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Team name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitNewTeam();
            }}
            className="h-9 w-full rounded-lg border border-border bg-secondary px-3 text-sm outline-none focus:border-ring"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewTeamOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!newTeamName.trim() || newTeamPending}
              onClick={() => void submitNewTeam()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {newTeamPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Create
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
