import type { RCARow } from "@/lib/hooks";

interface RcaBackgroundCardProps {
  rca: RCARow;
  editing?: boolean;
  incidentLine?: string | null;
  incidentShift?: string | null;
  incidentArea?: string | null;
  onChange?: (field: string, value: string) => void;
}

export function RcaBackgroundCard({
  rca,
  editing = false,
  incidentLine,
  incidentShift,
  incidentArea,
  onChange,
}: RcaBackgroundCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <span className="size-4 text-muted-foreground">ℹ</span>
        Incident Background
      </h2>
      <dl className="grid gap-4 md:grid-cols-2">
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Problem
          </dt>
          {editing ? (
            <input
              value={rca.problem ?? ""}
              onChange={(e) => onChange?.("problem", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <dd className="mt-1 text-sm whitespace-pre-line">{rca.problem || "—"}</dd>
          )}
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Observed Condition
          </dt>
          {editing ? (
            <input
              value={rca.observed_condition ?? ""}
              onChange={(e) => onChange?.("observed_condition", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <dd className="mt-1 text-sm whitespace-pre-line">{rca.observed_condition || "—"}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Root Cause Category (6M)
          </dt>
          {editing ? (
            <select
              value={rca.root_cause_category ?? ""}
              onChange={(e) => onChange?.("root_cause_category", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">—</option>
              <option value="man">Man</option>
              <option value="method">Method</option>
              <option value="machine">Machine</option>
              <option value="material">Material</option>
              <option value="measurement">Measurement</option>
              <option value="environment">Environment</option>
            </select>
          ) : (
            <dd className="mt-1 text-sm capitalize">
              {rca.root_cause_category?.replace(/_/g, " ") || "—"}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Containment Action
          </dt>
          {editing ? (
            <input
              value={rca.containment_action ?? ""}
              onChange={(e) => onChange?.("containment_action", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <dd className="mt-1 text-sm whitespace-pre-line">{rca.containment_action || "—"}</dd>
          )}
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Root Cause
          </dt>
          {editing ? (
            <input
              value={rca.root_cause ?? ""}
              onChange={(e) => onChange?.("root_cause", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-input bg-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          ) : (
            <dd className="mt-1 text-sm whitespace-pre-line">{rca.root_cause || "—"}</dd>
          )}
        </div>
        {rca.ai_insight && (
          <div className="col-span-2 rounded-lg border border-primary/40 bg-primary/10 p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-primary">AI Insight</dt>
            <dd className="mt-1 text-sm text-foreground/90 whitespace-pre-line">
              {rca.ai_insight}
            </dd>
          </div>
        )}
        <div className="col-span-2 rounded-xl border border-border bg-muted/50 p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
            Investigation Details
          </dt>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Owner (Who)
              </p>
              <p className="text-foreground/90">{rca.investigation_owner || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Created (When)
              </p>
              <p className="text-foreground/90">
                {rca.investigation_created || rca.created_at || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last Updated
              </p>
              <p className="text-foreground/90">{rca.updated_at || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Area · Line · Shift (Where)
              </p>
              <p className="text-foreground/90">
                {[incidentArea, incidentLine, incidentShift].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
        </div>
      </dl>
    </div>
  );
}
