# Event → Maintenance Flow Sync Fix

## Summary of Issues Fixed

### ✅ **Critical Bug #1: Read Path Completely Broken**
**Problem**: Frontend expected `PlannedMaintenanceItem[]` (array), but backend returned `{month, total, items[]}` (dict envelope)

**Impact**:
- Maintenance page always showed "No planned maintenance this month"
- ConsoleShell badge always showed 0
- Users couldn't see any planned maintenance items

**Fix**:
- Updated `usePlannedMaintenance()` to unwrap response: `return res?.items ?? []`
- Added new hooks for week and day endpoints
- Updated all consumers to work with unwrapped array

---

### ✅ **Critical Bug #2: Dead API Endpoints**
**Problem**: Frontend called non-existent endpoints

| Frontend Call | Status |
|---------------|--------|
| `PATCH /plants/{plantId}/planned-maintenance/{eventId}` | ❌ 404 - Doesn't exist |
| `POST .../planned-maintenance/{eventId}/complete` | ❌ 404 - Doesn't exist |

**Fix**: Replaced with correct endpoints:
- `PATCH /actions/{action_id}` (with `due_date`, `status`)
- `POST /actions/{action_id}/complete`

---

### ✅ **Critical Bug #3: Field Name Mismatches**
**Problem**: 11 of 17 fields didn't exist in backend response

**Before**: `planned_date`, `maintenance_notes`, `assigned_team`, etc.

**After**: Updated to match backend:
- `scheduled_date` (ISO datetime, not just date)
- `notes`
- `assigned_to` / `assigned_to_name`
- `line_id` / `line_name`
- `shift_id` / `shift_name`
- `team_id` / `team_name`
- `event_type`, `severity`, `observation`, `reported_cause`, `suspected_cause`
- `logged_by`, `created_at`
- `is_auto_routed` (new field to indicate auto-routing)

---

### ✅ **Feature Enhancement: Auto-Routing Indicator**
Added visual indicator when events are auto-routed to maintenance:
- Shows "⚡ Auto-routed" badge on maintenance items
- `is_auto_routed` flag set to `true` when action has no `due_date` (auto-created)
- `false` for manually planned items (has due_date from supervisor)

---

### ✅ **Improvement: Day/Week/Month Views**
Now properly uses backend endpoints instead of client-side filtering:
- Month view: `GET /plants/{plantId}/planned-maintenance?month=YYYY-MM`
- Week view: `GET /plants/{plantId}/planned-maintenance/week?date=YYYY-MM-DD`
- Day view: `GET /plants/{plantId}/planned-maintenance/day?date=YYYY-MM-DD`

---

## Changes Made

### Backend (`optilog-backend/app/domain/dashboard/service.py`)

**Enhanced `_get_planned_maintenance_range()` to include**:
- Line information (`line_id`, `line_name`)
- Shift information (`shift_id`, `shift_name`)
- Team information (`team_id`, `team_name`)
- Event details (`event_type`, `severity`, `observation`, `reported_cause`, `suspected_cause`)
- Operator information (`logged_by`)
- Timestamps (`created_at`)
- Auto-routing flag (`is_auto_routed`)

**Batch name resolution added**:
```python
line_names = await _batch_resolve_names(line_ids, collections.lines)
shift_names = await _batch_resolve_names(shift_ids, collections.shifts, name_field="shift_type")
team_names = await _batch_resolve_names(team_ids, collections.teams)
operator_names = await _batch_resolve_names(operator_ids, collections.users)
```

---

### Frontend (`optilog-frontend/src/lib/hooks.ts`)

**Updated `PlannedMaintenanceItem` interface**:
```typescript
export interface PlannedMaintenanceItem {
  id: string;
  source: "action" | "event";
  event_id: string;
  action_id: string;
  scheduled_date: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes: string;
  asset_id?: string;
  asset_name?: string;
  line_id?: string;
  line_name?: string;
  shift_id?: string;
  shift_name?: string;
  team_id?: string;
  team_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  event_type?: string;
  severity?: string;
  observation?: string;
  reported_cause?: string;
  suspected_cause?: string;
  logged_by?: string;
  created_at?: string;
  is_auto_routed?: boolean;
}
```

**Fixed hooks**:
- `usePlannedMaintenance()` - unwraps response array
- `usePlannedMaintenanceWeek()` - new hook for week endpoint
- `usePlannedMaintenanceDay()` - new hook for day endpoint
- `useUpdatePlannedMaintenance()` - uses correct `/actions/{id}` endpoint
- `useCompletePlannedMaintenance()` - uses correct `/actions/{id}/complete` endpoint

---

### Frontend (`optilog-frontend/src/routes/console/maintenance.tsx`)

**Complete rewrite with fixes**:
1. Uses correct hooks based on view mode (day/week/month)
2. Unwraps response array properly
3. Groups items by `scheduled_date.slice(0, 10)`
4. Uses `item.id` as React key (not `item.event_id`)
5. Displays auto-routing indicator badge
6. Shows status badge (pending/in_progress/completed/cancelled)
7. Calls correct mutation endpoints:
   - Complete: `POST /actions/${action_id}/complete`
   - Reschedule: `PATCH /actions/${action_id}` with `{due_date}`
   - Cancel: `PATCH /actions/${action_id}` with `{status: "cancelled"}`
8. Properly handles fields from new interface
9. Disables action buttons when completed or no action_id

---

## Testing Checklist

### ✅ **Backend Testing**
- [x] Verify planned-maintenance endpoint returns all new fields
- [x] Check line/shift/team/operator name resolution works
- [x] Verify `is_auto_routed` flag is set correctly

### ✅ **Frontend Testing**
- [x] TypeScript compilation passes (no errors)
- [ ] Run full build (vite build)
- [ ] Test month/week/day view switching
- [ ] Verify maintenance page loads with data (not empty)
- [ ] Test complete/reschedule/cancel actions
- [ ] Check auto-routing indicator displays correctly
- [ ] Verify ConsoleShell badge shows correct count

---

## API Contract Summary

### GET /plants/{plant_id}/planned-maintenance

**Query Parameters**:
- `month=YYYY-MM` (month view)
- `week` or `day` endpoints: `?date=YYYY-MM-DD`

**Response**:
```json
{
  "month": "2026-10",
  "total": 5,
  "items": [
    {
      "id": "action_id_or_event_id",
      "source": "action",
      "event_id": "evt_123",
      "action_id": "act_456",
      "scheduled_date": "2026-10-15T14:30:00Z",
      "status": "pending",
      "notes": "Replace bearing",
      "asset_id": "ast_789",
      "asset_name": "Conveyor Belt A",
      "line_id": "ln_001",
      "line_name": "Assembly Line 1",
      "shift_id": "shf_001",
      "shift_name": "morning",
      "team_id": "tm_001",
      "team_name": "Maintenance A",
      "assigned_to": "usr_001",
      "assigned_to_name": "John Smith",
      "event_type": "maintenance",
      "severity": "high",
      "observation": "Bearing worn on drive motor",
      "reported_cause": "Wear and tear",
      "suspected_cause": "Lack of lubrication",
      "logged_by": "Alice Johnson",
      "created_at": "2026-10-14T08:00:00Z",
      "is_auto_routed": true
    }
  ]
}
```

### POST /actions/{action_id}/complete

**Response**:
```json
{
  "id": "act_456",
  "status": "completed",
  "completed_at": "2026-10-15T16:00:00Z"
}
```

### PATCH /actions/{action_id}

**Request Body**:
```json
{
  "due_date": "2026-10-20T00:00:00Z",
  "status": "in_progress"
}
```

**Response**: Updated action object

---

## Breaking Changes

### ⚠️ **For Backend Team**
- Added new fields to planned-maintenance API response
- No breaking changes to existing endpoints
- New fields are additive

### ⚠️ **For Frontend Team**
- `PlannedMaintenanceItem` interface completely rewritten
- All consumers must use new field names
- API endpoints for update/complete changed
- Response envelope changed (now unwraps `items` array)

---

## Next Steps

1. **Deploy Backend**: Push updated `dashboard/service.py`
2. **Deploy Frontend**: Push updated hooks and maintenance.tsx
3. **Test End-to-End**: Verify all flows work in production
4. **Monitor Logs**: Check for any API errors or warnings
5. **User Acceptance**: Have supervisors test complete/reschedule/cancel flows

---

## Related Files

### Backend
- `optilog-backend/app/domain/dashboard/service.py` (enhanced)
- `optilog-backend/app/api/v1/dashboard.py` (unchanged, already had correct endpoints)

### Frontend
- `optilog-frontend/src/lib/hooks.ts` (updated interface and hooks)
- `optilog-frontend/src/routes/console/maintenance.tsx` (rewritten)
- `optilog-frontend/src/components/console/ConsoleShell.tsx` (unchanged, badge now works)

---

## Notes

- Auto-routing only applies to "observation" events (per backend `AUTO_ROUTE_TO_MAINTENANCE = {"observation"}`)
- Manual planning via timeline/end-shift still works and is supervisor-only
- Action can be completed even if event status doesn't change (backend behavior)
- Week and Day endpoints return same envelope format `{month, total, items[]}`

---

## Manual Maintenance Routing

Supervisors can push **any** event to maintenance by hand — auto-routing only
covers `observation` events at ingest, but manual routing works for
`downtime`, `quality`, `safety`, `maintenance`, `breakdown`, etc.

### Eligibility

| Rule | Value |
|---|---|
| Role | supervisor and above (frontend gate + backend `require_role("supervisor")`) |
| Event types | any — no type restriction |
| Excluded statuses | `planned_maintenance` (already routed), `resolved` (nothing to fix) |
| Already has a maintenance action | button disabled / labelled "Planned" |

### Surfaces (4)

| # | Surface | Trigger |
|---|---|---|
| 1 | Console → Reports (`reports.tsx`) | "Push to maintenance" on today's open events |
| 2 | Console → Events (`events.tsx`) | "Push to maintenance" in the expanded event row |
| 3 | Mobile → Timeline (`timeline.tsx`) | "Plan Maintenance" action on an event card |
| 4 | Mobile → End-shift (`end-shift.tsx`) | Same dialog on unresolved issues |

All four open the shared `PlanMaintenanceDialog`
(`src/components/shift/PlanMaintenanceDialog.tsx`).

### What the dialog shows

- **Issue card**: title (description/observation/event_type), subtitle (`asset · severity`)
- **Detail rows** (shown when present): type, line, reported cause, logged by, logged at
- Planned date picker + optional notes for the maintenance team

### What happens on confirm

1. `POST /shifts/{shift_id}/events/{event_id}/plan-maintenance` with
   `{ planned_date, notes, assigned_team }`
2. Backend creates (or idempotently updates) an `actions` doc with
   `type=maintenance_intervention` and a concrete `due_date`
3. Event status flips to `planned_maintenance`
4. Item appears in the maintenance calendar with `is_auto_routed: false`
5. Frontend invalidates `planned-maintenance` **and** `dashboard/{plantId}/events`
   queries so button labels update immediately

### Idempotency — manual after auto-route is safe

`plan_maintenance_for_event` (backend `events/service.py`) reuses an existing
`maintenance_intervention` action for the event instead of stacking duplicates.
A manual push after an auto-route is therefore an **override** (sets the
`due_date` the auto-route left empty), not a second action.

### Auto vs manual in the calendar

| | `is_auto_routed` | `due_date` | Badge |
|---|---|---|---|
| Auto (observation at ingest) | `true` | empty | ⚡ Auto-routed |
| Manual (any surface above) | `false` | set | — |
