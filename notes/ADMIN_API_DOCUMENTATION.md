# Admin API Documentation - Frontend Integration Guide

## Overview

This document describes the new Admin API endpoints for the OptiLog Client Onboarding System. All admin endpoints require `system_admin` role (level 6) via JWT authentication.

## Base URL

All admin endpoints are prefixed with `/api/v1/admin/`.

## Authentication

All admin endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

The token must belong to a user with `system_admin` role.

---

## New Collections

### Tenants Collection

Replaces the unused `organizations` collection. Schema:

```json
{
  "_id": ObjectId,
  "name": "string",
  "slug": "string (unique, URL-friendly)",
  "contact_email": "string",
  "status": "trial|active|suspended|cancelled",
  "trial_ends_at": "datetime|null",
  "max_users": "number",
  "max_plants": "number",
  "config": {
    "rca_enabled": "boolean",
    "integrations_enabled": "boolean",
    "analytics_enabled": "boolean",
    "max_events_per_month": "number|null"
  },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Invitations Collection

New collection for user invitation flow:

```json
{
  "_id": ObjectId,
  "tenant_id": "ObjectId",
  "email": "string",
  "role": "string",
  "plant_ids": ["ObjectId"],
  "token": "string (UUID v4, 32 chars)",
  "expires_at": "datetime",
  "accepted": "boolean",
  "created_at": "datetime"
}
```

---

## API Endpoints

### 1. Tenant Management

#### Create Tenant

```
POST /api/v1/admin/tenants
```

**Request Body:**
```json
{
  "name": "Acme Manufacturing",
  "slug": "acme-mfg",
  "contact_email": "admin@acme.com",
  "status": "trial",           // optional, default: "trial"
  "trial_days": 30,            // optional, default: 30
  "max_users": 10,             // optional, default: 10
  "max_plants": 1,             // optional, default: 1
  "config": {                   // optional
    "rca_enabled": true,
    "integrations_enabled": true,
    "analytics_enabled": true,
    "max_events_per_month": null
  }
}
```

**Response:** `TenantResponse`

#### List All Tenants

```
GET /api/v1/admin/tenants
```

**Response:** `list[TenantResponse]`

#### Get Tenant

```
GET /api/v1/admin/tenants/{tenant_id}
```

**Response:** `TenantResponse`

#### Update Tenant

```
PATCH /api/v1/admin/tenants/{tenant_id}
```

**Request Body:** Partial `TenantUpdate` object

**Response:** `TenantResponse`

#### Delete Tenant (Soft-delete)

```
DELETE /api/v1/admin/tenants/{tenant_id}
```

**Response:** `{"ok": true}`

---

### 2. Plant Management

#### Create Plant

```
POST /api/v1/admin/tenants/{tenant_id}/plants
```

**Request Body:**
```json
{
  "name": "Plant A",
  "location": "Lagos, Nigeria",    // optional
  "timezone": "Africa/Lagos"       // optional, default: "UTC"
}
```

**Response:** `PlantResponse`

#### List Tenant's Plants

```
GET /api/v1/admin/tenants/{tenant_id}/plants
```

**Response:** `list[PlantResponse]`

#### Get Plant

```
GET /api/v1/admin/plants/{plant_id}
```

**Response:** `PlantResponse`

#### Update Plant

```
PATCH /api/v1/admin/plants/{plant_id}
```

**Request Body:** Partial `PlantUpdate` object

**Response:** `PlantResponse`

#### Delete Plant (Soft-delete)

```
DELETE /api/v1/admin/plants/{plant_id}
```

**Response:** `{"ok": true}`

---

### 3. Plant Seeding

#### Seed Plant with Preset Data

```
POST /api/v1/admin/plants/{plant_id}/seed
```

**Request Body:**
```json
{
  "preset": "minimal",           // "minimal" | "standard" | "full"
  "include_demo_data": false     // optional, default: false
}
```

**Response:**
```json
{
  "plant_id": "string",
  "preset": "minimal",
  "created": {
    "areas": 3,
    "lines": 6,
    "assets": 0,
    "teams": 2,
    "users": 1,
    "shifts": 0,
    "events": 0,
    "connectors": 0
  }
}
```

**Preset Details:**

| Entity | Minimal | Standard | Full |
|--------|---------|----------|------|
| Areas | 3 | 4 | 5 |
| Lines per area | 2 | 3 | 4 |
| Assets per line | 0 | 4 | 6 |
| Teams | 2 | 3 | 4 |
| Users | 1 (admin) | 3 (admin, operator, supervisor) | 5 (all roles) |
| Historical shifts | 0 | 0 | 30 days |
| Events | 0 | 0 | ~200 |
| Connectors | 0 | 0 | 3 |

---

### 4. User Invitation

#### Invite User

```
POST /api/v1/admin/tenants/{tenant_id}/invite
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "operator",           // operator|technician|supervisor|shift_manager|plant_manager|integration_admin|system_admin
  "plant_ids": ["plant_id_1", "plant_id_2"]   // optional
}
```

**Response:** `InvitationResponse`

#### List Pending Invitations

```
GET /api/v1/admin/tenants/{tenant_id}/invitations
```

**Response:** `list[InvitationResponse]`

#### Revoke Invitation

```
DELETE /api/v1/admin/invitations/{invitation_id}
```

**Response:** `{"ok": true}`

#### Get Invitation Info (Public)

```
GET /api/v1/admin/invitations/{token}/info
```

**Response:** `InvitationResponse` (without token for security)

#### Accept Invitation (Public)

```
POST /api/v1/admin/invitations/{token}/accept
```

**Request Body:**
```json
{
  "token": "string",
  "name": "John Doe",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user_id": "string"
}
```

---

## Response Schemas

### TenantResponse

```json
{
  "id": "string",
  "name": "string",
  "slug": "string",
  "contact_email": "string",
  "status": "trial|active|suspended|cancelled",
  "trial_ends_at": "datetime|null",
  "max_users": 10,
  "max_plants": 1,
  "config": {
    "rca_enabled": true,
    "integrations_enabled": true,
    "analytics_enabled": true,
    "max_events_per_month": null
  },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### PlantResponse

```json
{
  "id": "string",
  "tenant_id": "string",
  "name": "string",
  "location": "string",
  "timezone": "string",
  "created_at": "datetime"
}
```

### InvitationResponse

```json
{
  "id": "string",
  "tenant_id": "string",
  "email": "string",
  "role": "string",
  "plant_ids": ["string"],
  "token": "string",
  "expires_at": "datetime",
  "accepted": false,
  "created_at": "datetime"
}
```

---

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request (invalid data, validation errors) |
| 403 | Forbidden (insufficient permissions, trial expired, tenant suspended) |
| 404 | Not Found (tenant/plant/invitation not found) |
| 409 | Conflict (duplicate slug, duplicate invitation) |
| 422 | Unprocessable Entity (Pydantic validation errors) |

---

## Frontend TypeScript Types

Add these types to `src/lib/shift-log.ts`:

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
  role: Role;
  plant_ids: string[];
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
}

type SeedPreset = "minimal" | "standard" | "full";
```

---

## React Query Hooks

Create `src/lib/admin-hooks.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

// Tenant hooks
export function useTenants() {
  return useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => api.get("/admin/tenants").then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post("/admin/tenants", data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

export function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.patch(`/admin/tenants/${tenantId}`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

export function useDeleteTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/tenants/${tenantId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] }),
  });
}

// Plant hooks
export function useTenantPlants(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "plants"],
    queryFn: () => api.get(`/admin/tenants/${tenantId}/plants`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useCreatePlant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/admin/tenants/${tenantId}/plants`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "plants"] }),
  });
}

export function useUpdatePlant(plantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.patch(`/admin/plants/${plantId}`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

export function useDeletePlant(plantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/plants/${plantId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

// Seed hook
export function useSeedPlant(plantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { preset: string; include_demo_data?: boolean }) =>
      api.post(`/admin/plants/${plantId}/seed`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "plants"] }),
  });
}

// Invitation hooks
export function useTenantInvitations(tenantId: string) {
  return useQuery({
    queryKey: ["admin", "tenants", tenantId, "invitations"],
    queryFn: () => api.get(`/admin/tenants/${tenantId}/invitations`).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useInviteUser(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/admin/tenants/${tenantId}/invite`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "tenants", tenantId, "invitations"] }),
  });
}

export function useRevokeInvitation(invitationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/admin/invitations/${invitationId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
}
```

---

## Environment Variables

Add to `.env.example`:

```bash
INVITATION_EXPIRY_DAYS=7
INVITATION_EMAIL_ENABLED=false    # Set true when email service configured
```

---

## Migration Notes

### Database Changes

1. **Rename Collection:** `organizations` → `tenants`
2. **New Collection:** `invitations`
3. **New Indexes:**
   - `tenants`: `{ slug: 1 }` (unique), `{ status: 1 }`
   - `plants`: `{ tenant_id: 1 }`
   - `invitations`: `{ token: 1 }` (unique), `{ tenant_id: 1, email: 1 }` (unique), `{ tenant_id: 1, accepted: 1 }`

### Backward Compatibility

- The `organizations` property in `collections.py` now aliases to `tenants` collection for backward compatibility
- Existing code using `collections.organizations` will continue to work

---

## Implementation Summary

### New Files Created

1. `app/schemas/admin.py` - Pydantic models for all admin endpoints
2. `app/domain/admin/__init__.py` - Empty init file
3. `app/domain/admin/service.py` - Tenant/Plant CRUD operations
4. `app/domain/admin/seed_service.py` - Configurable plant seeding with 3 presets
5. `app/domain/admin/invitation_service.py` - User invitation flow with token management
6. `app/api/v1/admin.py` - Admin API endpoints

### Modified Files

1. `app/db/collections.py` - Added `tenants` and `invitations` collections
2. `app/db/indexes.py` - Added indexes for tenants, plants, invitations
3. `app/core/dependencies.py` - Added `require_tenant_active()` middleware
4. `app/core/config.py` - Added `invitation_expiry_days` and `invitation_email_enabled` settings
5. `app/api/v1/router.py` - Registered admin router

### Key Features

1. **Tenant Management:** Full CRUD with status transitions and trial management
2. **Plant Management:** Full CRUD with tenant validation
3. **Plant Seeding:** 3 presets (minimal, standard, full) with configurable demo data
4. **User Invitation:** Token-based invitation flow with JWT generation
5. **Tenant Activity Check:** Middleware to enforce tenant status on operational endpoints
