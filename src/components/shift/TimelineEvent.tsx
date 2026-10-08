import { useRef, useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleDot,
  Loader2,
  Pencil,
  Play,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEventAudio, useFixTranscript, useRecording } from "@/lib/hooks";
import { STATUS_LABEL, formatTime, type ShiftEvent } from "@/lib/shift-log";

function statusIcon(status: ShiftEvent["status"]) {
  if (status === "resolved") return <CircleCheck className="size-5 text-success" />;
  if (status === "investigating") return <CircleDot className="size-5 text-warning" />;
  if (status === "confirmed") return <CircleDot className="size-5 text-primary" />;
  return <CircleDot className="size-5 text-muted-foreground" />;
}

/**
 * One expandable event row of the shift timeline — shared by the timeline
 * page and the end-of-shift summary so both offer the same detail view and
 * the same edit / delete / plan-maintenance actions.
 */
export function TimelineEventRow({
  event,
  open,
  onToggle,
  shiftId,
  canEdit,
  canDelete,
  canPlanMaintenance,
  onEdit,
  onDelete,
  onPlanMaintenance,
}: {
  event: ShiftEvent;
  open: boolean;
  onToggle: () => void;
  shiftId?: string | undefined;
  canEdit: boolean;
  canDelete: boolean;
  canPlanMaintenance: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPlanMaintenance: () => void;
}) {
  // Destructive action: the delete button arms itself before removing anything.
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          onToggle();
        }}
        className="flex w-full items-center gap-3 px-4 py-4 text-left"
      >
        <span className="text-lg font-black tabular-nums">{formatTime(event.timestamp)}</span>
        <span className="flex-1">
          <span className="block text-lg font-bold leading-tight">
            {event.event_type || "Untitled event"}
          </span>
          <span className="block text-sm text-muted-foreground">
            {event.asset}
            {event.duration_minutes !== null ? ` · ${event.duration_minutes} min` : ""}
            {event.sync === "pending" ? " · pending sync" : ""}
          </span>
        </span>
        {statusIcon(event.status)}
        <ChevronDown
          className={`size-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <Detail label="Status" value={STATUS_LABEL[event.status] ?? event.status} />
          {event.subsystem ? <Detail label="Subsystem" value={event.subsystem} /> : null}
          <Detail label="Observation" value={event.observation || "—"} />
          <Detail label="Reported cause" value={event.reported_cause || "—"} />
          {event.suspected_cause ? (
            <Detail label="Suspected cause" value={event.suspected_cause} />
          ) : null}
          <Detail label="Verified cause" value={event.verified_cause || "Not verified"} />
          <Detail label="Action taken" value={event.action_taken || "—"} />
          <Detail label="Logged by" value={`${event.logged_by} · ${event.source}`} />
          <RecordingBlock event={event} shiftId={shiftId} />

          {canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground"
            >
              <Pencil className="size-5" /> Edit event
            </button>
          ) : null}

          {canDelete ? (
            confirming ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="h-14 flex-1 rounded-2xl border border-border bg-secondary font-bold"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onDelete();
                  }}
                  className="h-14 flex-1 rounded-2xl bg-destructive font-black text-destructive-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <Trash2 className="size-5" /> Delete
                  </span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 font-bold text-destructive"
              >
                <Trash2 className="size-5" /> Delete event
              </button>
            )
          ) : null}

          {canPlanMaintenance &&
          event.status !== "resolved" &&
          event.status !== "planned_maintenance" ? (
            <button
              type="button"
              onClick={onPlanMaintenance}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-secondary font-bold"
            >
              <Wrench className="size-5" /> Plan Maintenance
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base leading-snug break-words">{value}</p>
    </div>
  );
}

/**
 * Transcript + audio for a voice event: plays the recording, shows the ASR
 * original when a human correction replaced it, and lets the operator fix the
 * transcript (the diff becomes auto-verified vocabulary lessons).
 */
function RecordingBlock({ event, shiftId }: { event: ShiftEvent; shiftId: string | undefined }) {
  const recording = useRecording(event.recording_id);
  const fixTranscript = useFixTranscript(event.recording_id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!event.recording_id && !event.transcript) return null;

  const rec = recording.data;
  const transcript = rec?.transcript ?? event.transcript ?? "";
  const original = rec?.transcript_original;
  const failed = rec?.status === "failed";
  const processing = !!rec && !failed && rec.status !== "completed";

  const startEditing = () => {
    setDraft(transcript);
    setEditing(true);
  };

  return (
    <div className="space-y-2">
      <div className="max-h-48 overflow-y-auto rounded-xl bg-secondary p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Transcript
        </p>
        {original ? (
          <p className="mt-1 text-sm text-muted-foreground line-through break-words">
            Original ASR: "{original}"
          </p>
        ) : null}
        <p className="mt-1 text-base italic leading-snug break-words">
          {transcript ? `"${transcript}"` : "No transcript captured."}
        </p>
        {processing ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Audio is still processing…
          </p>
        ) : null}
        {failed ? (
          <p className="mt-1.5 text-xs text-destructive">
            Audio could not be processed — playback may be unavailable.
          </p>
        ) : null}
      </div>

      {event.recording_id ? <PlayAudioButton shiftId={shiftId} eventId={event.id} /> : null}

      {event.recording_id ? (
        editing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Corrected transcript"
              className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm italic text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="h-11 flex-1 rounded-xl border border-border bg-secondary font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={fixTranscript.isPending || !draft.trim()}
                onClick={() => {
                  const next = draft.trim();
                  if (!next || next === transcript) {
                    setEditing(false);
                    return;
                  }
                  fixTranscript.mutate(next, { onSuccess: () => setEditing(false) });
                }}
                className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-60"
              >
                {fixTranscript.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                Save correction
              </button>
            </div>
            {fixTranscript.error ? (
              <p className="text-xs text-destructive">
                {fixTranscript.error instanceof Error
                  ? fixTranscript.error.message
                  : "Could not save the correction"}
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-bold"
          >
            <Pencil className="size-4" /> Fix transcript
          </button>
        )
      ) : null}
    </div>
  );
}

export function PlayAudioButton({
  shiftId,
  eventId,
}: {
  shiftId: string | undefined;
  eventId: string;
}) {
  const audioQuery = useEventAudio(shiftId, eventId);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }
    const url = audioQuery.data?.audio_url;
    if (!url) return;
    const audio = new Audio(url);
    audio.onended = () => {
      setPlaying(false);
      audioRef.current = null;
    };
    audio.play();
    audioRef.current = audio;
    setPlaying(true);
  };

  if (!audioQuery.data?.audio_url && !audioQuery.isLoading) return null;

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={audioQuery.isLoading}
      className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card font-bold disabled:opacity-60"
    >
      {audioQuery.isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Play className="size-5" />
      )}
      {playing ? "Pause audio" : "Play audio"}
    </button>
  );
}
