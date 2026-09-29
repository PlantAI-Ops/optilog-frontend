# FRONTEND_NOTES.md

> **Source of truth for frontend-backend sync.** Updated autonomously whenever endpoints, features, or breaking changes land. Frontend team: read this before starting any task.

---

## Invitation Email System (New)

When an admin sends an invite, the backend now **optionally sends an email** via SendGrid.

### What the frontend needs to handle

**Route:** `/invite?token={token}`

This is a **public route** (no auth required). The email links to:
```
{FRONTEND_INVITE_URL}?token={token}
```

### Flow

1. User lands on `/invite?token=abc123`
2. Frontend calls `GET /api/v1/admin/invitations/{token}/info` to fetch invitation details
3. Display: tenant name, role, plant_ids, expiry date
4. If expired or already accepted, show an error state
5. User fills in: `name`, `password` (min 8 chars)
6. Frontend calls `POST /api/v1/admin/invitations/{token}/accept` with `{ token, name, password }`
7. Response: `{ access_token, refresh_token, user_id }` — store tokens and redirect to dashboard

### Error states to handle

| Condition | API Response | UI |
|-----------|-------------|-----|
| Invalid token | 404 | "Invitation not found" |
| Expired | 401 | "This invitation has expired" |
| Already accepted | 401 | "This invitation has already been used" |
| Email already exists | 409 | "An account with this email already exists" |
| Password too short | 422 | Validation error |

### Invitation Info Response

```typescript
interface InvitationInfo {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  plant_ids: string[];
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}
```

### Accept Invitation Request/Response

```typescript
// POST /api/v1/admin/invitations/{token}/accept
interface InvitationAcceptRequest {
  token: string;
  name: string;
  password: string; // min 8 chars
}

interface InvitationAcceptResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
}
```

---

## Plant Setup — Onboarding Wizard (New)

### Endpoint

```
POST /api/v1/admin/plants/{plantId}/setup
```

**Auth:** `plant_manager` or higher

### Request body

```json
{
  "areas": [
    { "name": "Assembly", "description": "Main assembly area" },
    { "name": "Packaging", "description": "Final packaging" }
  ],
  "lines": [
    { "name": "Line-1", "areaIndex": 0 },
    { "name": "Line-2", "areaIndex": 0 },
    { "name": "Line-3", "areaIndex": 1 }
  ],
  "teams": [
    {
      "name": "Team A",
      "shift_config": {
        "type": "rotating",
        "pattern": "3-3-3-3",
        "hours": {
          "morning": { "start": 6, "end": 14 },
          "afternoon": { "start": 14, "end": 22 },
          "night": { "start": 22, "end": 6 }
        }
      },
      "current_shift": "morning",
      "assigned_line_indices": [0, 1]
    },
    {
      "name": "Team B",
      "shift_config": {
        "type": "rotating",
        "pattern": "3-3-3-3",
        "hours": {
          "morning": { "start": 6, "end": 14 },
          "afternoon": { "start": 14, "end": 22 },
          "night": { "start": 22, "end": 6 }
        }
      },
      "current_shift": "afternoon",
      "assigned_line_indices": [0]
    },
    {
      "name": "Team C",
      "shift_config": {
        "type": "rotating",
        "pattern": "3-3-3-3",
        "hours": {
          "morning": { "start": 6, "end": 14 },
          "afternoon": { "start": 14, "end": 22 },
          "night": { "start": 22, "end": 6 }
        }
      },
      "current_shift": "night",
      "assigned_line_indices": [2]
    },
    {
      "name": "Team D",
      "shift_config": {
        "type": "rotating",
        "pattern": "3-3-3-3",
        "hours": {
          "morning": { "start": 6, "end": 14 },
          "afternoon": { "start": 14, "end": 22 },
          "night": { "start": 22, "end": 6 }
        }
      },
      "current_shift": "off",
      "assigned_line_indices": []
    }
  ],
  "globalShiftType": "rotating_3333",
  "lineShiftMode": "per_line"
}
```

### Response

```json
{
  "plant_id": "6a9ef11e19339b89a74147e8",
  "created": {
    "areas": 2,
    "lines": 3,
    "teams": 4
  }
}
```

### Validation errors

| Status | Condition | Detail |
|--------|-----------|--------|
| 422 | `areas` is empty | "field required" |
| 422 | `areaIndex` out of range | "area_index {n} out of range (have {m} areas)" |
| 422 | Invalid `globalShiftType` | Must be one of: `regular_day`, `extended_rotating`, `rotating_2222`, `rotating_3333` |
| 409 | Shift pattern overlap | "Overlaps with '{shift_type}' ({start}:00–{end}:00)" |

### What the backend creates

1. **Area records** — one per entry in `areas`
2. **Line records** — one per entry in `lines`, linked to areas via `areaIndex`
3. **Team records** — one per entry in `teams`, with `shift_config` stored on the document
4. **Shift patterns** — generated from team shift_configs:
   - `rotating_3333` → 3 patterns: morning (6-14), afternoon (14-22), night (22-6)
   - `rotating_2222` → same patterns
   - `extended_rotating` → 2 patterns: day (7-19), night (19-7)
   - `regular_day` → 1 pattern per team with their start/end hours
5. **Rotation metadata** — stored in `plant_rotation_config` collection:
   - `team_order`: ordered list of team IDs
   - `pattern`: "2-2-2-2", "3-3-3-3", or "extended"
   - `day_offset`: calculated from first team's `current_shift`

### Shift config types

```typescript
// Standard weekday shift
{ type: "regular_day", start_hour: 8, end_hour: 17, weekdays_only: true }

// 12-hour day shift, 7 days/week
{ type: "extended_day", start_hour: 7, end_hour: 19 }

// 12-hour night shift, 7 days/week (wraps midnight)
{ type: "night", start_hour: 19, end_hour: 7 }

// Continental rotating — 4 teams cycle through morning/afternoon/night/off
{ type: "rotating", pattern: "3-3-3-3", hours: { morning: {start:6, end:14}, afternoon: {start:14, end:22}, night: {start:22, end:6} } }
{ type: "rotating", pattern: "2-2-2-2", hours: { ... } }
```

### Rotation behavior

The shift generator assigns **one team per shift type per day**:

- **3-3-3-3**: Each team works 3 mornings → 3 afternoons → 3 nights → 3 off → repeat
- **2-2-2-2**: Each team works 2 mornings → 2 afternoons → 2 nights → 2 off → repeat
- **extended_rotating**: Each team works 1 day → 1 night → 1 off → repeat

The `current_shift` field on each team determines their starting position in the rotation cycle.

### Line shift modes

- `"all"` (default): Shift patterns apply to all lines in the plant. One shift per team per pattern per day.
- `"per_line"`: Shift patterns can have a `line_id` set. Shifts are created per line.

---

## All API Endpoints

Base URL: `/api/v1`

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | No | Login, returns JWT pair |
| POST | `/auth/refresh` | No | Refresh access token |
| GET | `/auth/me` | Yes | Get current user |
| PATCH | `/auth/me` | Yes | Update current user |
| POST | `/auth/register` | system_admin | Create user for tenant |

### Admin — Tenants (system_admin only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/tenants` | system_admin | Create tenant |
| GET | `/admin/tenants` | system_admin | List tenants |
| GET | `/admin/tenants/{id}` | system_admin | Get tenant |
| PATCH | `/admin/tenants/{id}` | system_admin | Update tenant |
| DELETE | `/admin/tenants/{id}` | system_admin | Soft-delete tenant |

### Admin — Plants (plant_manager+)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/tenants/{id}/plants` | plant_manager+ | Create plant |
| GET | `/admin/tenants/{id}/plants` | plant_manager+ | List tenant plants |
| GET | `/admin/plants/{id}` | plant_manager+ | Get plant |
| PATCH | `/admin/plants/{id}` | plant_manager+ | Update plant |
| DELETE | `/admin/plants/{id}` | plant_manager+ | Soft-delete plant |
| POST | `/admin/plants/{id}/setup` | plant_manager+ | Onboarding wizard setup |
| POST | `/admin/plants/{id}/seed` | plant_manager+ | Seed plant with preset |

### Admin — Invitations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/tenants/{id}/invite` | plant_manager+ | Create invitation + send email |
| GET | `/admin/tenants/{id}/invitations` | plant_manager+ | List pending invitations |
| DELETE | `/admin/invitations/{id}` | plant_manager+ | Revoke invitation |
| GET | `/admin/invitations/{token}/info` | **No** | Get invitation details (public) |
| POST | `/admin/invitations/{token}/accept` | **No** | Accept invitation, create user (public) |

---

## TypeScript Types

```typescript
type TenantStatus = "trial" | "active" | "suspended" | "cancelled";

interface TenantConfig {
  rca_enabled: boolean;
  integrations_enabled: boolean;
  analytics_enabled: boolean;
  max_events_per_month: number | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  status: TenantStatus;
  trial_ends_at: string | null;
  max_users: number;
  max_plants: number;
  config: TenantConfig;
  created_at: string;
  updated_at: string;
}

interface Plant {
  id: string;
  tenant_id: string;
  name: string;
  location: string;
  timezone: string;
  created_at: string;
}

interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  plant_ids: string[];
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

type SeedPreset = "minimal" | "standard" | "full";

type Role = "operator" | "technician" | "supervisor" | "shift_manager" | "plant_manager" | "integration_admin" | "system_admin";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenant_id: string;
  plant_ids: string[];
  active: boolean;
  created_at: string;
}

// ── Shift Config (discriminated union) ──────────────

interface ShiftHours {
  morning: { start: number; end: number };
  afternoon: { start: number; end: number };
  night: { start: number; end: number };
}

interface RegularDayConfig {
  type: "regular_day";
  start_hour: number;
  end_hour: number;
  weekdays_only: boolean;
}

interface ExtendedDayConfig {
  type: "extended_day";
  start_hour: number;
  end_hour: number;
}

interface NightConfig {
  type: "night";
  start_hour: number;
  end_hour: number;
}

interface RotatingConfig {
  type: "rotating";
  pattern: "2-2-2-2" | "3-3-3-3";
  hours: ShiftHours;
}

type ShiftConfig = RegularDayConfig | ExtendedDayConfig | NightConfig | RotatingConfig;

// ── Plant Setup (Onboarding Wizard) ─────────────────

interface AreaSetup {
  name: string;
  description?: string;
}

interface LineSetup {
  name: string;
  areaIndex: number; // 0-based index into the areas array
}

interface TeamSetup {
  name: string;
  shift_config: ShiftConfig;
  current_shift?: string; // "morning"|"afternoon"|"night"|"day"|"off"
  assigned_line_indices?: number[]; // indices into lines array; empty = all lines
}

interface PlantSetupRequest {
  areas: AreaSetup[];
  lines: LineSetup[];
  teams: TeamSetup[];
  globalShiftType: "regular_day" | "extended_rotating" | "rotating_2222" | "rotating_3333";
  lineShiftMode?: "all" | "per_line"; // default "all"
}

interface PlantSetupResponse {
  plant_id: string;
  created: {
    areas: number;
    lines: number;
    teams: number;
  };
}
```

---

## React Query Hooks

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// ── Auth ──────────────────────────────────────────
export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; client_type?: "mobile" | "desktop" }) =>
      api.post("/auth/login", data).then((r) => r.data),
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: (data: { refresh_token: string; client_type?: string }) =>
      api.post("/auth/refresh", data).then((r) => r.data),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
    retry: false,
  });
}

// ── Invitation (public, no auth) ──────────────────
export function useInvitationInfo(token: string) {
  return useQuery({
    queryKey: ["invitation", token],
    queryFn: () => api.get(`/admin/invitations/${token}/info`).then((r) => r.data),
    retry: false,
    enabled: !!token,
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (data: { token: string; name: string; password: string }) =>
      api.post(`/admin/invitations/${data.token}/accept`, data).then((r) => r.data),
  });
}

// ── Tenants (system_admin) ────────────────────────
export function useTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get("/admin/tenants").then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post("/admin/tenants", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

export function useUpdateTenant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.patch(`/admin/tenants/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

export function useDeleteTenant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/tenants/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

// ── Plants (plant_manager+) ───────────────────────
export function useTenantPlants(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "plants"],
    queryFn: () => api.get(`/admin/tenants/${tenantId}/plants`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreatePlant(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/admin/tenants/${tenantId}/plants`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] }),
  });
}

export function useUpdatePlant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.patch(`/admin/plants/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

export function useDeletePlant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/plants/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

export function useSeedPlant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { preset: SeedPreset; include_demo_data?: boolean }) =>
      api.post(`/admin/plants/${id}/seed`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

export function useSetupPlant(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PlantSetupRequest) =>
      api.post(`/admin/plants/${id}/setup`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

// ── Invitations (plant_manager+) ──────────────────
export function useTenantInvitations(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "invitations"],
    queryFn: () => api.get(`/admin/tenants/${tenantId}/invitations`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useInviteUser(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string; plant_ids?: string[] }) =>
      api.post(`/admin/tenants/${tenantId}/invite`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "invitations"] }),
  });
}

export function useRevokeInvitation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/invitations/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
}
```

---

## Error Codes

| Status | Meaning | Frontend Action |
|--------|---------|-----------------|
| 400 | Bad request | Show validation errors |
| 401 | Unauthorized | Redirect to login / show expired state |
| 403 | Forbidden | Show "insufficient permissions" |
| 404 | Not found | Show not found state |
| 409 | Conflict | Show "already exists" message |
| 422 | Validation error | Show field-level errors |

---

## Changelog

| Date | Change | Breaking? |
|------|--------|-----------|
| 2026-09-08 | Added invitation email system (SendGrid). New public endpoints: `GET /invitations/{token}/info`, `POST /invitations/{token}/accept`. New env vars: `SENDGRID_API_KEY`, `SENDGRID_SENDER_EMAIL`, `FRONTEND_INVITE_URL`. | No — existing token-based flow unchanged |
| 2026-09-08 | **Onboarding wizard setup endpoint.** New `POST /admin/plants/{plantId}/setup` — creates areas, lines, teams with shift configs, generates shift patterns, stores rotation metadata. Request body: `{ areas, lines, teams, globalShiftType, lineShiftMode }`. | No — new endpoint |
| 2026-09-08 | **ShiftConfig discriminated union.** Teams now accept `shift_config` field with type: `regular_day`, `extended_day`, `night`, or `rotating`. `TeamCreate` and `TeamUpdate` schemas updated. | No — `shift_config` is optional, defaults to `regular_day` 8-17 |
| 2026-09-08 | **Shift pattern overlap validation.** Creating/updating shift patterns now returns `409 Conflict` if the new pattern overlaps with an existing pattern for the same plant/line and shares common days. | No — new validation |
| 2026-09-08 | **Shift generator rewrite.** Generator now supports team rotation (2-2-2-2, 3-3-3-3, extended_rotating), enforces `days_of_week`, and supports line-level shifts. One team per shift type per day. | No — existing patterns without rotation config work as before |
| 2026-09-08 | **Per-line shift patterns.** Shift patterns now accept optional `line_id`. If set, shifts are scoped to that line. If null, applies to all lines in the plant. | No — `line_id` is optional |
| 2026-09-19 | **My Events fallback fix.** `GET /plants/{plantId}/my-events` now falls back to all plant events for the date when the user has no team or no active shift. Previously returned `[]` in these cases, causing mobile events to disappear after re-login. | No — existing behavior preserved for users with teams/shifts |
