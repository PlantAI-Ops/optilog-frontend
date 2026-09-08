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
