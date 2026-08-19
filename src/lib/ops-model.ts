/**
 * Shift-Log canonical operational data model.
 *
 * Every record — whether captured by an operator on mobile, pulled from MES,
 * pushed by SCADA or imported from CSV — is normalised into these shapes.
 * The desktop console reads exclusively from this layer.
 */

export type SourceSystem =
  | "operator"
  | "supervisor"
  | "mes"
  | "scada"
  | "cmms"
  | "erp"
  | "api"
  | "import"
  | "ai";

export type EventType =
  | "downtime"
  | "quality"
  | "maintenance"
  | "safety"
  | "observation"
  | "production"
  | "breakdown"
  | "environmental";

export type Severity = "low" | "medium" | "high" | "critical";
export type OpsStatus = "open" | "in_progress" | "resolved" | "under_review";

export interface Asset {
  id: string;
  name: string;
  line_id: string;
}
export interface Line {
  id: string;
  name: string;
  area_id: string;
}
export interface Area {
  id: string;
  name: string;
  plant_id: string;
}
export interface Plant {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  supervisor: string;
  headcount: number;
}

export interface Shift {
  id: string;
  name: string;
  team_id: string;
  line_id: string;
  date: string;
  start: string;
  end: string;
  produced: number;
  target: number;
  downtime_minutes: number;
  status: "active" | "closed" | "approved";
}

export interface OperationalEvent {
  id: string;
  timestamp: string;
  plant_id: string;
  area_id: string;
  line_id: string;
  asset_id: string;
  shift_id: string;
  team_id: string;
  event_type: EventType;
  category: string;
  severity: Severity;
  description: string;
  observation: string;
  reported_cause: string;
  verified_cause: string;
  action: string;
  status: OpsStatus;
  source: SourceSystem;
  source_record_id: string;
  duration_seconds: number | null;
  evidence: string[];
  incident_id?: string;
}

export interface IncidentTimelineEntry {
  time: string;
  label: string;
  source: SourceSystem;
}

export interface Incident {
  id: string;
  ref: string;
  title: string;
  line_id: string;
  shift_id: string;
  date: string;
  duration_minutes: number;
  status: OpsStatus;
  owner: string;
  due_date: string;
  problem: string;
  observed_condition: string;
  root_cause: string;
  five_why: { question: string; answer: string }[];
  corrective_action: string;
  preventive_action: string;
  timeline: IncidentTimelineEntry[];
  evidence: { label: string; source: SourceSystem }[];
  event_ids: string[];
  ai_insight: string;
}

export type ConnectorKind =
  | "rest"
  | "webhook"
  | "sql"
  | "csv"
  | "mqtt"
  | "opcua"
  | "sftp";
export type ConnectorDirection = "inbound" | "outbound" | "bidirectional";
export type ConnectorHealth = "healthy" | "degraded" | "error" | "disabled";

export interface Connector {
  id: string;
  name: string;
  system: SourceSystem;
  kind: ConnectorKind;
  direction: ConnectorDirection;
  health: ConnectorHealth;
  endpoint: string;
  last_sync: string;
  records_24h: number;
  mapped_entities: string[];
  mapping: { external: string; canonical: string }[];
}

/* ------------------------------ seed data ------------------------------ */

export const plant: Plant = { id: "plant_01", name: "Ikeja Plant" };

export const areas: Area[] = [
  { id: "area_pack", name: "Packaging", plant_id: "plant_01" },
  { id: "area_proc", name: "Processing", plant_id: "plant_01" },
];

export const lines: Line[] = [
  { id: "line_02", name: "Packaging Line 2", area_id: "area_pack" },
  { id: "line_03", name: "Packaging Line 3", area_id: "area_pack" },
  { id: "line_07", name: "Blend Line 7", area_id: "area_proc" },
];

export const assets: Asset[] = [
  { id: "asset_conv_02", name: "Infeed conveyor", line_id: "line_02" },
  { id: "asset_lab_02", name: "Labeller", line_id: "line_02" },
  { id: "asset_conv_03", name: "Conveyor sensor", line_id: "line_03" },
  { id: "asset_motor_03", name: "Drive motor", line_id: "line_03" },
  { id: "asset_mix_07", name: "Mixer", line_id: "line_07" },
];

export const teams: Team[] = [
  { id: "team_a", name: "Team A", supervisor: "R. Okafor", headcount: 11 },
  { id: "team_b", name: "Team B", supervisor: "A. Bello", headcount: 12 },
  { id: "team_c", name: "Team C", supervisor: "N. Eze", headcount: 9 },
];

const TODAY = "2026-08-15";

export const shifts: Shift[] = [
  {
    id: "shift_a1",
    name: "Shift 1",
    team_id: "team_a",
    line_id: "line_02",
    date: TODAY,
    start: "06:00",
    end: "14:00",
    produced: 8640,
    target: 9000,
    downtime_minutes: 38,
    status: "approved",
  },
  {
    id: "shift_b2",
    name: "Shift 2",
    team_id: "team_b",
    line_id: "line_03",
    date: TODAY,
    start: "14:00",
    end: "22:00",
    produced: 8420,
    target: 9000,
    downtime_minutes: 47,
    status: "active",
  },
  {
    id: "shift_c3",
    name: "Shift 3",
    team_id: "team_c",
    line_id: "line_07",
    date: TODAY,
    start: "22:00",
    end: "06:00",
    produced: 6370,
    target: 7000,
    downtime_minutes: 61,
    status: "closed",
  },
  {
    id: "shift_a1_prev",
    name: "Shift 1",
    team_id: "team_a",
    line_id: "line_03",
    date: "2026-08-14",
    start: "06:00",
    end: "14:00",
    produced: 8910,
    target: 9000,
    downtime_minutes: 22,
    status: "approved",
  },
  {
    id: "shift_b2_prev",
    name: "Shift 2",
    team_id: "team_b",
    line_id: "line_03",
    date: "2026-08-14",
    start: "14:00",
    end: "22:00",
    produced: 7980,
    target: 9000,
    downtime_minutes: 74,
    status: "approved",
  },
];

function evt(e: Partial<OperationalEvent> & Pick<OperationalEvent, "id" | "timestamp" | "line_id" | "asset_id" | "shift_id" | "team_id" | "event_type" | "category" | "description">): OperationalEvent {
  const line = lines.find((l) => l.id === e.line_id)!;
  return {
    plant_id: plant.id,
    area_id: line.area_id,
    severity: "medium",
    observation: "",
    reported_cause: "",
    verified_cause: "",
    action: "",
    status: "resolved",
    source: "operator",
    source_record_id: e.id,
    duration_seconds: null,
    evidence: [],
    ...e,
  } as OperationalEvent;
}

export const events: OperationalEvent[] = [
  evt({
    id: "evt_1001",
    timestamp: `${TODAY}T14:14:00Z`,
    line_id: "line_03",
    asset_id: "asset_conv_03",
    shift_id: "shift_b2",
    team_id: "team_b",
    event_type: "downtime",
    category: "mechanical",
    severity: "high",
    description: "Packaging Line 3 stopped — conveyor sensor not detecting product",
    observation: "Product accumulating before the sensor gate, no index pulse.",
    reported_cause: "Sensor fault suspected",
    verified_cause: "Photo-eye sensor failure",
    action: "Sensor replaced by maintenance, line restarted",
    duration_seconds: 2820,
    source: "operator",
    source_record_id: "voice_88431",
    evidence: ["Operator voice report", "Photo", "MES downtime record"],
    incident_id: "inc_1024",
  }),
  evt({
    id: "evt_1002",
    timestamp: `${TODAY}T14:16:00Z`,
    line_id: "line_03",
    asset_id: "asset_conv_03",
    shift_id: "shift_b2",
    team_id: "team_b",
    event_type: "downtime",
    category: "mechanical",
    severity: "high",
    description: "MES downtime record PKG-L03 / SENSOR",
    duration_seconds: 2820,
    source: "mes",
    source_record_id: "MES-DT-449120",
    incident_id: "inc_1024",
  }),
  evt({
    id: "evt_1003",
    timestamp: `${TODAY}T14:22:00Z`,
    line_id: "line_03",
    asset_id: "asset_conv_03",
    shift_id: "shift_b2",
    team_id: "team_b",
    event_type: "maintenance",
    category: "corrective",
    description: "Work order WO-77120 raised and closed — photo-eye replacement",
    source: "cmms",
    source_record_id: "WO-77120",
    incident_id: "inc_1024",
  }),
  evt({
    id: "evt_1004",
    timestamp: `${TODAY}T15:02:00Z`,
    line_id: "line_02",
    asset_id: "asset_lab_02",
    shift_id: "shift_a1",
    team_id: "team_a",
    event_type: "quality",
    category: "labelling",
    severity: "medium",
    description: "Labels skewed on SKU-204, roughly 1 in 20 packs",
    observation: "Web tension appears inconsistent at speed.",
    reported_cause: "Label web tension",
    status: "under_review",
    source: "operator",
    source_record_id: "voice_88450",
    evidence: ["Operator voice report", "QA samples"],
  }),
  evt({
    id: "evt_1005",
    timestamp: `${TODAY}T09:41:00Z`,
    line_id: "line_02",
    asset_id: "asset_conv_02",
    shift_id: "shift_a1",
    team_id: "team_a",
    event_type: "downtime",
    category: "material",
    description: "Carton shortage — line idled waiting on stores",
    duration_seconds: 720,
    source: "erp",
    source_record_id: "SAP-MM-9931",
  }),
  evt({
    id: "evt_1006",
    timestamp: `${TODAY}T23:18:00Z`,
    line_id: "line_07",
    asset_id: "asset_mix_07",
    shift_id: "shift_c3",
    team_id: "team_c",
    event_type: "downtime",
    category: "electrical",
    severity: "critical",
    description: "Mixer VFD trip on overcurrent",
    duration_seconds: 3660,
    status: "open",
    source: "scada",
    source_record_id: "ALM-22815",
  }),
  evt({
    id: "evt_1007",
    timestamp: `${TODAY}T16:05:00Z`,
    line_id: "line_03",
    asset_id: "asset_motor_03",
    shift_id: "shift_b2",
    team_id: "team_b",
    event_type: "observation",
    category: "condition",
    description: "Grinding noise from drive motor at high speed",
    reported_cause: "Possible bearing wear",
    action: "Logged for inspection next shift",
    status: "open",
    source: "operator",
    source_record_id: "voice_88462",
  }),
  evt({
    id: "evt_1008",
    timestamp: "2026-08-14T15:12:00Z",
    line_id: "line_03",
    asset_id: "asset_conv_03",
    shift_id: "shift_b2_prev",
    team_id: "team_b",
    event_type: "downtime",
    category: "mechanical",
    severity: "high",
    description: "Line 3 sensor stoppage (recurrence 3 of 4 in 14 shifts)",
    duration_seconds: 1980,
    source: "mes",
    source_record_id: "MES-DT-448770",
  }),
  evt({
    id: "evt_1009",
    timestamp: "2026-08-14T08:35:00Z",
    line_id: "line_03",
    asset_id: "asset_conv_03",
    shift_id: "shift_a1_prev",
    team_id: "team_a",
    event_type: "safety",
    category: "near_miss",
    severity: "high",
    description: "Guard interlock bypass attempt reported near conveyor 3",
    status: "in_progress",
    source: "supervisor",
    source_record_id: "sup_2201",
  }),
];

export const incidents: Incident[] = [
  {
    id: "inc_1024",
    ref: "#1024",
    title: "Packaging Line 3 stoppage — conveyor sensor",
    line_id: "line_03",
    shift_id: "shift_b2",
    date: TODAY,
    duration_minutes: 47,
    status: "under_review",
    owner: "A. Bello",
    due_date: "2026-08-20",
    problem: "Packaging line stopped for 47 minutes during Shift B.",
    observed_condition: "Conveyor photo-eye not detecting product; no index pulse to PLC.",
    root_cause: "Pending engineering confirmation — repeat photo-eye failure suspected.",
    five_why: [
      { question: "Why did production stop?", answer: "The conveyor stopped indexing product." },
      { question: "Why did the conveyor stop?", answer: "The PLC received no product-present signal." },
      { question: "Why was there no signal?", answer: "The photo-eye sensor failed." },
      { question: "Why did the sensor fail?", answer: "Housing exposed to washdown ingress." },
      { question: "Why wasn't it detected earlier?", answer: "No condition check on the sensor in the PM routine." },
    ],
    corrective_action: "Photo-eye replaced with IP69K-rated unit and re-aligned.",
    preventive_action: "Add sensor condition check to weekly PM; review washdown procedure on Line 3.",
    timeline: [
      { time: "14:14", label: "Machine stopped", source: "scada" },
      { time: "14:16", label: "Operator reported issue (voice)", source: "operator" },
      { time: "14:22", label: "Maintenance notified — WO-77120", source: "cmms" },
      { time: "14:29", label: "Technician arrived at line", source: "cmms" },
      { time: "14:41", label: "Sensor replaced", source: "cmms" },
      { time: "15:01", label: "Production resumed", source: "mes" },
    ],
    evidence: [
      { label: "Operator voice report", source: "operator" },
      { label: "MES downtime event MES-DT-449120", source: "mes" },
      { label: "Maintenance work order WO-77120", source: "cmms" },
      { label: "Machine alarm ALM-22790", source: "scada" },
      { label: "Photo of sensor housing", source: "operator" },
      { label: "3 previous sensor incidents", source: "ai" },
    ],
    event_ids: ["evt_1001", "evt_1002", "evt_1003", "evt_1008"],
    ai_insight:
      "This is the 4th sensor-related stoppage on Line 3 in the last 14 shifts, accounting for 152 minutes of downtime. Three occurred within 40 minutes of a washdown cycle.",
  },
  {
    id: "inc_1025",
    ref: "#1025",
    title: "Blend Line 7 mixer VFD trip",
    line_id: "line_07",
    shift_id: "shift_c3",
    date: TODAY,
    duration_minutes: 61,
    status: "open",
    owner: "N. Eze",
    due_date: "2026-08-22",
    problem: "Mixer tripped on overcurrent, 61 minutes lost on night shift.",
    observed_condition: "VFD fault code F002 recorded twice before the trip.",
    root_cause: "Not yet determined.",
    five_why: [
      { question: "Why did the mixer stop?", answer: "The VFD tripped on overcurrent." },
      { question: "Why was current high?", answer: "Batch viscosity above spec." },
      { question: "", answer: "" },
      { question: "", answer: "" },
      { question: "", answer: "" },
    ],
    corrective_action: "Batch drained and remixed at reduced load.",
    preventive_action: "",
    timeline: [
      { time: "23:18", label: "VFD overcurrent alarm", source: "scada" },
      { time: "23:24", label: "Operator voice report logged", source: "operator" },
      { time: "23:55", label: "Electrician on site", source: "cmms" },
      { time: "00:19", label: "Mixer restarted at reduced load", source: "mes" },
    ],
    evidence: [
      { label: "SCADA alarm ALM-22815", source: "scada" },
      { label: "Operator voice report", source: "operator" },
      { label: "Batch record BR-4471", source: "erp" },
    ],
    event_ids: ["evt_1006"],
    ai_insight:
      "Viscosity deviations on Blend Line 7 correlate with raw material lot RM-8842 across 2 of the last 3 trips.",
  },
];

export const connectors: Connector[] = [
  {
    id: "con_mes",
    name: "Plant MES",
    system: "mes",
    kind: "rest",
    direction: "inbound",
    health: "healthy",
    endpoint: "https://mes.internal/api/v2/downtime",
    last_sync: "2 min ago",
    records_24h: 1284,
    mapped_entities: ["Downtime", "Production"],
    mapping: [
      { external: "equipment", canonical: "asset_id" },
      { external: "downtime_reason", canonical: "category" },
      { external: "duration", canonical: "duration_seconds" },
      { external: "start_ts", canonical: "timestamp" },
    ],
  },
  {
    id: "con_scada",
    name: "SCADA alarm bus",
    system: "scada",
    kind: "mqtt",
    direction: "inbound",
    health: "healthy",
    endpoint: "mqtt://scada.internal:1883/plant/+/alarms",
    last_sync: "live",
    records_24h: 5390,
    mapped_entities: ["Event", "Asset"],
    mapping: [
      { external: "tag", canonical: "asset_id" },
      { external: "alarm_class", canonical: "severity" },
      { external: "ts", canonical: "timestamp" },
    ],
  },
  {
    id: "con_cmms",
    name: "CMMS work orders",
    system: "cmms",
    kind: "sql",
    direction: "bidirectional",
    health: "degraded",
    endpoint: "postgres://cmms.internal:5432/maximo",
    last_sync: "38 min ago",
    records_24h: 74,
    mapped_entities: ["Maintenance", "Action"],
    mapping: [
      { external: "wo_number", canonical: "source_record_id" },
      { external: "asset_tag", canonical: "asset_id" },
      { external: "wo_status", canonical: "status" },
    ],
  },
  {
    id: "con_erp",
    name: "ERP material movements",
    system: "erp",
    kind: "sftp",
    direction: "inbound",
    health: "healthy",
    endpoint: "sftp://erp.internal/exports/mm/*.csv",
    last_sync: "1 h ago",
    records_24h: 210,
    mapped_entities: ["Production", "Event"],
    mapping: [
      { external: "matnr", canonical: "metadata.material" },
      { external: "werks", canonical: "plant_id" },
    ],
  },
  {
    id: "con_out",
    name: "Operational event webhook",
    system: "api",
    kind: "webhook",
    direction: "outbound",
    health: "healthy",
    endpoint: "POST https://bi.internal/hooks/shiftlog",
    last_sync: "just now",
    records_24h: 962,
    mapped_entities: ["Event", "Incident", "Shift"],
    mapping: [{ external: "shiftlog.event.created", canonical: "OperationalEvent" }],
  },
  {
    id: "con_opc",
    name: "OPC UA gateway",
    system: "scada",
    kind: "opcua",
    direction: "inbound",
    health: "disabled",
    endpoint: "opc.tcp://gw.internal:4840",
    last_sync: "never",
    records_24h: 0,
    mapped_entities: ["Asset"],
    mapping: [],
  },
];

/* ------------------------------ selectors ------------------------------ */

export const lineName = (id: string) => lines.find((l) => l.id === id)?.name ?? id;
export const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? id;
export const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id;
export const shiftById = (id: string) => shifts.find((s) => s.id === id);

export const achievement = (s: Shift) => Math.round((s.produced / s.target) * 1000) / 10;

export const todayShifts = shifts.filter((s) => s.date === TODAY);
export const todayEvents = events.filter((e) => e.timestamp.startsWith(TODAY));

export function plantSummary() {
  const produced = todayShifts.reduce((n, s) => n + s.produced, 0);
  const target = todayShifts.reduce((n, s) => n + s.target, 0);
  return {
    achievement: Math.round((produced / target) * 1000) / 10,
    produced,
    target,
    downtime: todayShifts.reduce((n, s) => n + s.downtime_minutes, 0),
    activeIssues: events.filter((e) => e.status === "open" || e.status === "in_progress").length,
    unresolved: events.filter((e) => e.status === "open").length,
    quality: todayEvents.filter((e) => e.event_type === "quality").length,
    rcaPending: incidents.filter((i) => i.status !== "resolved").length,
  };
}

export function teamSummary(teamId: string) {
  const ts = shifts.filter((s) => s.team_id === teamId);
  const te = events.filter((e) => e.team_id === teamId);
  const produced = ts.reduce((n, s) => n + s.produced, 0);
  const target = ts.reduce((n, s) => n + s.target, 0);
  return {
    shifts: ts,
    achievement: target ? Math.round((produced / target) * 1000) / 10 : 0,
    events: te.length,
    downtime: ts.reduce((n, s) => n + s.downtime_minutes, 0),
    open: te.filter((e) => e.status === "open" || e.status === "in_progress").length,
  };
}

export function assetRollup() {
  return assets
    .map((a) => {
      const ae = events.filter((e) => e.asset_id === a.id);
      return {
        asset: a,
        count: ae.length,
        downtime: Math.round(ae.reduce((n, e) => n + (e.duration_seconds ?? 0), 0) / 60),
        topCategories: [...new Set(ae.map((e) => e.category))].slice(0, 3),
      };
    })
    .sort((a, b) => b.downtime - a.downtime);
}

export const SOURCE_LABEL: Record<SourceSystem, string> = {
  operator: "Operator",
  supervisor: "Supervisor",
  mes: "MES",
  scada: "SCADA",
  cmms: "CMMS",
  erp: "ERP",
  api: "API",
  import: "Import",
  ai: "AI",
};

export const STATUS_LABEL: Record<OpsStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  under_review: "Under review",
};