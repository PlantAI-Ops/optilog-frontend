import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { ConsoleShell, SourceBadge, StatCard } from "@/components/console/ConsoleShell";
import { SOURCE_LABEL } from "@/lib/ops-model";
import { useShiftLog } from "@/lib/shift-log";
import { usePlantConnectors, type ConnectorRow } from "@/lib/hooks";

export const Route = createFileRoute("/console/integrations")({
  head: () => ({
    meta: [
      { title: "Shift-Log Connect | Integration Hub" },
      {
        name: "description",
        content:
          "Configure connectors to MES, SCADA, CMMS and ERP over REST, SQL, MQTT, OPC UA, SFTP and webhooks, and map external schemas to the canonical model.",
      },
      { property: "og:title", content: "Shift-Log Connect | Integration Hub" },
      {
        property: "og:description",
        content: "Two-way interoperability with existing plant systems.",
      },
    ],
  }),
  component: IntegrationsPage,
});

const healthTone: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  error: "bg-destructive",
  disabled: "bg-muted-foreground",
};

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "inbound") return <ArrowDownToLine className="size-4" />;
  if (direction === "outbound") return <ArrowUpFromLine className="size-4" />;
  return <ArrowLeftRight className="size-4" />;
}

function IntegrationsPage() {
  const user = useShiftLog().user;
  const plantId = user?.plant_ids?.[0];
  const connectorsQuery = usePlantConnectors(plantId);
  const connectors = connectorsQuery.data ?? [];
  const [id, setId] = useState<string | undefined>(undefined);
  const connector = connectors.find((c) => c.id === id) ?? connectors[0];
  const total = connectors.reduce((n, c) => n + c.records_24h, 0);

  if (id === undefined && connectors.length > 0) {
    setId(connectors[0]!.id);
  }

  return (
    <ConsoleShell
      title="Shift-Log Connect"
      subtitle="Connectors → adapters → canonical operational model"
    >
      {connectorsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Connectors" value={connectors.length} hint="Inbound · outbound · two-way" />
            <StatCard label="Records ingested (24h)" value={total.toLocaleString()} tone="success" />
            <StatCard
              label="Degraded"
              value={connectors.filter((c) => c.health !== "healthy").length}
              tone="warning"
            />
            <StatCard label="Canonical entities" value={12} hint="Plant → Area → Line → Asset" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
            <section className="rounded-xl border border-border bg-card">
              <header className="border-b border-border px-4 py-3 text-sm font-semibold">Sources & destinations</header>
              <ul className="divide-y divide-border/60">
                {connectors.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setId(c.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                        c.id === id ? "bg-secondary" : "hover:bg-secondary/50"
                      }`}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${healthTone[c.health]}`} />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.kind.toUpperCase()} · {c.direction} · {c.last_sync}
                        </span>
                      </span>
                      <DirectionIcon direction={c.direction} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {connector && (
              <section className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{connector.name}</h2>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{connector.endpoint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <SourceBadge>{SOURCE_LABEL[connector.system] ?? connector.system.toUpperCase()}</SourceBadge>
                      <SourceBadge>{connector.kind}</SourceBadge>
                      <SourceBadge>{connector.health}</SourceBadge>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-border py-2">
                      <p className="text-xs text-muted-foreground">Records 24h</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {connector.records_24h.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border py-2">
                      <p className="text-xs text-muted-foreground">Last sync</p>
                      <p className="text-sm font-semibold">{connector.last_sync}</p>
                    </div>
                    <div className="rounded-lg border border-border py-2">
                      <p className="text-xs text-muted-foreground">Entities</p>
                      <p className="text-sm font-semibold">{connector.mapped_entities.join(", ") || "—"}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card">
                  <header className="border-b border-border px-4 py-3 text-sm font-semibold">
                    Field mapping → canonical model
                  </header>
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-2 text-left font-medium">External field</th>
                        <th className="px-4 py-2 text-left font-medium">Canonical field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connector.mapping.map((m) => (
                        <tr key={m.external} className="border-b border-border/60 last:border-0">
                          <td className="px-4 py-2 font-mono text-xs">{m.external}</td>
                          <td className="px-4 py-2 font-mono text-xs text-primary">{m.canonical}</td>
                        </tr>
                      ))}
                      {connector.mapping.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-4 py-4 text-sm text-muted-foreground">
                            No mapping configured — connector disabled.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <CodeCard
                    title="Inbound payload (MES)"
                    code={`{
  "equipment": "PKG-L03",
  "downtime_reason": "MATERIAL",
  "duration": 1432
}`}
                  />
                  <CodeCard
                    title="Normalised operational event"
                    code={`{
  "event_type": "downtime",
  "asset_id": "line_03",
  "category": "material",
  "duration_seconds": 1432,
  "source": {
    "system": "mes",
    "record_id": "MES-DT-449120"
  }
}`}
                  />
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </ConsoleShell>
  );
}

function CodeCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs text-muted-foreground">
        {code}
      </pre>
    </div>
  );
}