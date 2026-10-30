# OptiLog RCA Enhancement — Implementation Notes

**Date:** 2026-10-30  
**Scope:** Fullstack — backend (`optilog-backend`) + frontend (`optilog-frontend`)  
**Priority:** P1-P4 (all completed)

---

## Backend Changes (`optilog-backend`)

### 1. RCA Close / Reopen Endpoints
**Files modified:**
- `app/domain/rca/service.py`
- `app/api/v1/rca.py`

**New service functions:**
- `close_rca(rca_id, tenant_id)` — transitions RCA `approved` → `closed` (409 if not approved)
- `reopen_rca(rca_id, tenant_id)` — transitions RCA `closed` → `approved` (409 if not closed)

**New API endpoints:**
- `POST /rca/{rca_id}/close` — requires `supervisor` role
- `POST /rca/{rca_id}/reopen` — requires `supervisor` role

**Pre-existing bugs fixed in `create_rca_from_event`:**
- Added missing `if not existing_incident:` guard around incident creation
- Added missing `asset`/`line_id` resolution from event's asset
- Fixed unbound `incident_id` when reusing an existing incident
- Fixed undefined `oid_tenant` in `create_rca`
- Added routed-status rejection: events in `escalated`, `planned_maintenance`, `resolved`, or `deleted` cannot seed a new incident (unless an incident already exists for that event)

### 2. Actions: `assigned_to_name` Resolution
**File modified:** `app/domain/actions/service.py`

**New helper:** `_resolve_assigned_names(docs, tenant_id)` — batch-joins `assigned_to` ObjectIds with the `users` collection and attaches `assigned_to_name` to each action doc.

**Updated functions:** `list_actions()` and `get_action()` now return `assigned_to_name` on each action in the response.

### 3. Action Types Enum
**File modified:** `app/schemas/actions.py`

- Added `ActionType = Literal["corrective", "preventive", "verification", "monitoring"]`
- `ActionCreate.type` now uses `ActionType` instead of free-form `str`

**File modified:** `app/domain/actions/service.py`
- Added `ACTION_TYPES = {"corrective", "preventive", "verification", "monitoring"}`

### 4. Tests (all passing)
**File created:** `tests/api/test_rca_actions.py` (8 tests)
- `test_close_rca_from_approved`
- `test_close_rca_from_non_approved_returns_409`
- `test_reopen_rca_from_closed`
- `test_reopen_rca_from_non_closed_returns_409`
- `test_close_reopen_require_supervisor_role`
- `test_actions_list_includes_assigned_to_name`
- `test_action_create_with_invalid_type`
- `test_action_create_with_valid_types`

**Verification:** All 353 backend tests pass (`uv run pytest tests/`)

---

## Frontend Changes (`optilog-frontend`)

### 1. New Hooks (`src/lib/hooks.ts`)
- `useCloseRCA()` — mutation for `POST /rca/{id}/close`
- `useReopenRCA()` — mutation for `POST /rca/{id}/reopen`
- `useRCAActions(incidentId)` — query for `GET /actions?incident_id=…` with `assigned_to_name`
- `useCreateRCAAction()` — mutation for `POST /actions`
- `useUpdateRCAAction()` — mutation for `PATCH /actions/{id}`
- `useCompleteRCAAction()` — mutation for `POST /actions/{id}/complete`

**Type updates:** `RCAAction` now includes `ref`, `event_id`, `assigned_to`, `assigned_to_name`, and updated `type`/`status` enums matching the backend.

### 2. New Components (`src/components/rca/`)
- **`RcaStepper.tsx`** — 6-step visual stepper: Background → 5-Why → Timeline → Evidence → Actions → Review. Flexible navigation: can click completed/current steps, disabled on future steps.
- **`RcaBackgroundCard.tsx`** — Incident background display: problem, observed condition, root cause category (6M), containment action, root cause, AI insight.
- **`FiveWhyEditor.tsx`** — Dynamic 5-Why editor: add/remove steps, textareas for question/answer when editing.
- **`TimelineEditor.tsx`** — Editable timeline entries: time, label, source dropdown.
- **`EvidenceEditor.tsx`** — Editable evidence entries: label, source dropdown.
- **`RcaActionsCard.tsx`** — Structured actions card: list actions with status badges + assignee name, add-action modal (type, description, assignee, due date), complete button per action.

### 3. RCA Page Rewrite (`src/routes/console/rca.tsx`)
- **Stepper integration** with status-based step access (flexible navigation)
- **Editable sections** using textareas when in edit mode (Background, 5-Why, Timeline, Evidence)
- **Fixed `hasRCA` logic:** now checks `!!rca.data?.id && rca.data.status !== "draft"` instead of just `!!rca.data?.id`
- **Severity column** added to incident list display
- **Close / Reopen buttons** wired to new backend endpoints with supervisor role gating
- **Status badges** color-coded: draft (secondary), in_progress (info), completed (primary), approved (success), closed (warning)
- **AI Insight** displayed in Review step
- Background card shown on Background step

### 4. Pre-existing Fix (`src/lib/ops-model.ts`)
- Fixed missing closing `}` on the `Incident` interface (line 124) that was causing a TS1131 error.

### Verification
- `tsc --noEmit` — passes (no errors)
- `eslint` — passes for all new/changed files (only pre-existing `any` warnings remain)
- `vite build` — passes successfully (client + SSR + nitro)

---

## Status Flow

```
draft ──Start Investigation──> in_progress ──Submit for Review──> completed ──Approve──> approved ──Close──> closed
                                                                                              │
                                                                                              └──Reopen──┘
```

**Step-to-status mapping:**
| Step | Status Required |
|------|----------------|
| Background | draft+ |
| 5-Why | in_progress+ |
| Timeline | in_progress+ |
| Evidence | in_progress+ |
| Actions | completed+ |
| Review | approved+ |

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 5-Why steps | Dynamic (add/remove) | User requested dynamic steps |
| Stepper navigation | Flexible | User requested flexible (jump to completed/current) |
| Timeline/Evidence editor | Plain text inputs | Simpler, matches existing UI patterns |
| Assignee resolution | Backend join (`assigned_to_name`) | Avoids N+1 queries on frontend |
| Action types | Enum (`corrective`\|`preventive`\|`verification`\|`monitoring`) | User requested adding to schema |
| Evidence on action complete | Optional | User specified optional for now |
| Reopen target status | `approved` | User confirmed |
| AI Insight location | Review step | User confirmed |
