// ─── Enums / Unions ──────────────────────────────────────────────────────────

export type ClientType = "mobile" | "desktop";

export type Role =
  | "operator"
  | "technician"
  | "supervisor"
  | "shift_manager"
  | "plant_manager"
  | "integration_admin"
  | "system_admin";

export const ROLE_HIERARCHY: Record<Role, number> = {
  operator: 0,
  technician: 1,
  supervisor: 2,
  shift_manager: 3,
  plant_manager: 4,
  integration_admin: 5,
  system_admin: 6,
};

export type EventType =
  | "production_stop"
  | "downtime"
  | "quality"
  | "maintenance"
  | "safety"
  | "observation"
  | "production";

export type EventCategory =
  | "equipment"
  | "material"
  | "mechanical"
  | "electrical"
  | "labelling"
  | "condition"
  | "corrective"
  | "near_miss"
  | string;

export type Severity = "low" | "medium" | "high" | "critical";

export type EventStatus =
  | "draft"
  | "confirmed"
  | "rejected"
  | "resolved"
  | "deleted"
  | "escalated";

export type ShiftType = "morning" | "afternoon" | "night";

export type ShiftStatus = "scheduled" | "active" | "closed";

export type ActionStatus = "pending" | "in_progress" | "completed";

export type RecordingStatus = "pending" | "completed" | "uploaded" | "transcribed" | "failed";

export type AttachmentType = "photo" | "audio" | "document";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
  client_type?: ClientType;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface RefreshRequest {
  refresh_token: string;
  client_type?: ClientType;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenant_id: string;
  plant_ids: string[];
  active: boolean;
  created_at?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
  plant_ids?: string[];
}

export interface UpdateMeRequest {
  name?: string;
  role?: Role;
  plant_ids?: string[];
  active?: boolean;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: Role;
  plant_ids?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  role?: Role;
  plant_ids?: string[];
  active?: boolean;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export interface PlantResponse {
  id: string;
  name: string;
  timezone: string;
  tenant_id: string;
  active: boolean;
}

export interface CreatePlantRequest {
  name: string;
  timezone?: string;
}

export interface AreaResponse {
  id: string;
  name: string;
  plant_id: string;
}

export interface CreateAreaRequest {
  name: string;
}

export interface LineResponse {
  id: string;
  name: string;
  area_id: string;
}

export interface CreateLineRequest {
  name: string;
}

export interface AssetResponse {
  id: string;
  name: string;
  line_id?: string;
  external_id?: string;
  metadata?: Record<string, string>;
}

export interface CreateAssetRequest {
  name: string;
  external_id?: string;
  metadata?: Record<string, string>;
}

// ─── Teams ───────────────────────────────────────────────────────────────────

export interface TeamResponse {
  id: string;
  name: string;
  plant_id: string;
  tenant_id: string;
  supervisor_id: string | null;
  member_ids: string[];
  active: boolean;
}

export interface CreateTeamRequest {
  name: string;
  plant_id: string;
  supervisor_id?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  supervisor_id?: string;
}

export interface SetTeamMembersRequest {
  member_ids: string[];
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

export interface ShiftResponse {
  id: string;
  plant_id: string;
  team_id: string;
  tenant_id: string;
  shift_type: ShiftType;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  supervisor_id: string | null;
  operator_ids: string[];
  status: ShiftStatus;
  handover: ShiftHandover | null;
  summary: ShiftSummary;
}

export interface ShiftSummary {
  event_count: number;
  open_issues: number;
  downtime_seconds: number;
}

export interface ShiftHandover {
  notes: string;
  open_issues: string[];
}

export interface CreateShiftRequest {
  plant_id: string;
  team_id: string;
  shift_type: ShiftType;
  planned_start: string;
  planned_end: string;
}

export interface SubmitHandoverRequest {
  notes: string;
  open_issues: string[];
}

export interface ShiftTimelineEntry {
  id: string;
  event_type: string;
  status: string;
  severity: string;
  observation: string;
  timestamp: string;
}

export interface ListShiftsParams extends PaginationParams {
  plant_id: string;
  team_id?: string;
  status?: ShiftStatus;
  date_from?: string;
  date_to?: string;
}

// ─── Events ──────────────────────────────────────────────────────────────────

export interface EventAsset {
  asset_id: string;
  name: string;
}

export interface EventSource {
  type: string;
  system: string;
  record_id: string | null;
}

export interface EventResponse {
  id: string;
  tenant_id: string;
  plant_id: string;
  event_type: EventType;
  category?: string;
  timestamp: string;
  asset: EventAsset | null;
  shift_id: string | null;
  team_id: string | null;
  observation: string;
  reported_cause: string | null;
  verified_cause: string | null;
  duration_seconds: number | null;
  severity: Severity | null;
  status: EventStatus;
  source: EventSource;
  evidence: string[];
  ai: unknown | null;
  assignee_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateEventRequest {
  plant_id: string;
  event_type: EventType;
  category?: string;
  timestamp: string;
  asset_id?: string;
  asset_name?: string;
  shift_id?: string;
  team_id?: string;
  observation: string;
  reported_cause?: string;
  duration_seconds?: number;
  severity?: Severity;
  metadata?: Record<string, unknown>;
}

export interface UpdateEventRequest {
  observation?: string;
  verified_cause?: string;
  severity?: Severity;
  category?: string;
  duration_seconds?: number;
  reported_cause?: string;
  metadata?: Record<string, unknown>;
}

export interface AssignEventRequest {
  assignee_id: string;
}

export interface ListEventsParams extends PaginationParams {
  plant_id?: string;
  team_id?: string;
  shift_id?: string;
  asset_id?: string;
  event_type?: EventType;
  status?: EventStatus;
  severity?: Severity;
  start?: string;
  end?: string;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export interface ActionResponse {
  id: string;
  event_id: string | null;
  incident_id: string | null;
  tenant_id: string;
  type: string;
  description: string;
  assigned_to: string | null;
  due_date: string | null;
  status: ActionStatus;
  completed_at: string | null;
  created_at: string;
}

export interface CreateActionRequest {
  event_id?: string;
  incident_id?: string;
  type: string;
  description: string;
  assigned_to?: string;
  due_date?: string;
}

export interface UpdateActionRequest {
  description?: string;
  assigned_to?: string;
  due_date?: string;
  status?: ActionStatus;
}

export interface ListActionsParams extends PaginationParams {
  event_id?: string;
  incident_id?: string;
  assigned_to?: string;
  status?: ActionStatus;
}

// ─── Recordings ──────────────────────────────────────────────────────────────

export interface RecordingResponse {
  id: string;
  user_id: string;
  plant_id: string | null;
  shift_id: string | null;
  filename: string;
  status: RecordingStatus;
  transcript?: string;
  created_at: string;
}

// ─── Attachments ─────────────────────────────────────────────────────────────

export interface AttachmentResponse {
  id: string;
  event_id: string | null;
  recording_id: string | null;
  type: AttachmentType;
  filename: string;
  storage_path: string;
  created_at: string;
}

export interface AttachmentUrlResponse {
  url: string;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string;
}
