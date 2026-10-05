# Backend Notes — Onboarding Wizard Flow

This document describes the complete onboarding wizard flow from the frontend perspective, including all API endpoints, request/response shapes, and validation rules. Use this to implement or verify the backend endpoints.

---

## Overview

The onboarding wizard is a 6-step flow that creates a new plant and configures its operational structure:

```
Step 1: Plant Details  →  POST /admin/tenants/{tenantId}/plants
Step 2: Areas          →  (local state only)
Step 3: Lines          →  (local state only)
Step 4: Teams          →  (local state only)
Step 5: Seed Data      →  3 options (see below)
Step 6: Review         →  (display only)
```

**Key insight**: Steps 2–4 collect configuration in local state. The data is only sent to the backend in Step 5, depending on which option the user chooses.

---

## Step 1: Plant Details

Creates the plant record.

### Request

```
POST /admin/tenants/{tenantId}/plants
```

```json
{
  "name": "Factory Alpha",
  "location": "Austin, TX",
  "timezone": "America/Chicago"
}
```

### Response

```json
{
  "id": "plant_abc123",
  "tenant_id": "tenant_xyz",
  "name": "Factory Alpha",
  "location": "Austin, TX",
  "timezone": "America/Chicago",
  "created_at": "2026-09-08T12:00:00Z"
}
```

### Validation

- `name` — required, non-empty string
- `location` — optional string
- `timezone` — optional, defaults to `"UTC"`

---

## Steps 2–4: Configuration (Local State)

These steps collect data in the React component state. **No API calls are made during these steps.** The data is held in memory and optionally saved to localStorage for resume.

### Data Shapes

#### AreaData

```typescript
interface AreaData {
  name: string;        // e.g. "Assembly", "Packaging"
  description: string; // optional description
}
```

#### LineData

```typescript
interface LineData {
  name: string;    // e.g. "Line-1", "Line-2"
  areaIndex: number; // index into the areas array (0-based)
}
```

Lines are generated per-area. The wizard has a "Lines per area" input that auto-generates `Line-1`, `Line-2`, etc. for each area.

#### TeamData

```typescript
interface TeamData {
  name: string;           // always "Team A", "Team B", "Team C", "Team D"
  shift_config: ShiftConfig;
  current_shift?: string; // only for rotating/extended types
  assigned_line_indices?: number[]; // NEW — indices into the lines array
}
```

`assigned_line_indices` maps each team to specific lines:
- Empty array `[]` or omitted = team covers all lines (used with `lineShiftMode: "all"`)
- Non-empty array = team is assigned to those specific lines (used with `lineShiftMode: "per_line"`)
- Indices are 0-based into the `lines` array from the same request

#### ShiftConfig (discriminated union)

```typescript
type ShiftConfig =
  | {
      type: "regular_day";
      start_hour: number;    // 0–23
      end_hour: number;      // 0–23
      weekdays_only: boolean;
    }
  | {
      type: "rotating";
      pattern: "2-2-2-2" | "3-3-3-3";
      hours: {
        morning:   { start: number; end: number };
        afternoon: { start: number; end: number };
        night:     { start: number; end: number };
      };
    }
  | {
      type: "extended_rotating";
      hours: {
        day:   { start: number; end: number };
        night: { start: number; end: number };
      };
    };
```

#### Shift Types and Team Counts

| Shift Type | Teams | current_shift options |
|------------|-------|-----------------------|
| `regular_day` | 1 (user-defined) | N/A |
| `extended_rotating` | 3 | `"day"`, `"night"`, `"off"` |
| `rotating` (2-2-2-2) | 4 | `"morning"`, `"afternoon"`, `"night"`, `"off"` |
| `rotating` (3-3-3-3) | 4 | `"morning"`, `"afternoon"`, `"night"`, `"off"` |
| `custom` | user-defined | N/A (per-team config) |

#### Wizard-Level Settings

```typescript
globalShiftType: string;  // "regular_day" | "extended_rotating" | "rotating_2222" | "rotating_3333" | "custom"
customShiftName: string;  // name of custom shift (e.g. "Continental", "DuPont")
lineShiftMode: "all" | "per_line";  // currently only "all" is functional
```

---

## Step 5: Seed Data — Three Options

The user chooses one of three modes:

### Option A: "Use My Setup" (`setupMode: "config"`)

Sends the wizard-configured areas, lines, and teams to a new backend endpoint.

#### Request

```
POST /admin/plants/{plantId}/setup
```

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
        "type": "extended_rotating",
        "hours": {
          "day": { "start": 7, "end": 19 },
          "night": { "start": 19, "end": 7 }
        }
      },
      "current_shift": "day",
      "assigned_line_indices": [0, 1]
    },
    {
      "name": "Team B",
      "shift_config": {
        "type": "extended_rotating",
        "hours": {
          "day": { "start": 7, "end": 19 },
          "night": { "start": 19, "end": 7 }
        }
      },
      "current_shift": "night",
      "assigned_line_indices": [2]
    },
    {
      "name": "Team C",
      "shift_config": {
        "type": "extended_rotating",
        "hours": {
          "day": { "start": 7, "end": 19 },
          "night": { "start": 19, "end": 7 }
        }
      },
      "current_shift": "off",
      "assigned_line_indices": []
    }
  ],
  "globalShiftType": "extended_rotating",
  "customShiftName": "",
  "lineShiftMode": "per_line"
}
```

#### Response

```json
{
  "plant_id": "plant_abc123",
  "created": {
    "areas": 2,
    "lines": 3,
    "teams": 3
  }
}
```

#### Backend Requirements

- Create area records for the plant
- Create line records, each linked to an area via `areaIndex`
- Create team records with their shift configs
- For rotating/extended types: create shift schedule records based on the `hours` config and `current_shift` position
- For `regular_day`: create a single shift record with the start/end hours
- **Line assignment** (`assigned_line_indices` on each team):
  - Empty array or omitted = team covers all lines (shift patterns apply globally)
  - Non-empty array = create shift patterns scoped to those specific lines (set `line_id` on each shift pattern)
  - Indices are 0-based into the `lines` array from the request
- Return a `created` object with counts of what was created

---

### Option B: "Seed with Preset" (`setupMode: "preset"`)

Uses the existing seed endpoint with a predefined template.

#### Request

```
POST /admin/plants/{plantId}/seed
```

```json
{
  "preset": "standard",
  "include_demo_data": true
}
```

#### Presets

| Preset | Areas | Lines/Area | Assets/Line | Teams | Users | History | Events | Connectors |
|--------|-------|------------|-------------|-------|-------|---------|--------|------------|
| `minimal` | 3–5 | 2–4 | — | 2–4 | 1 (admin) | — | — | — |
| `standard` | 4 | 3 | 4 | 3 | 3 | — | — | — |
| `full` | 5 | 4 | 6 | 4 | 5 | 30 days | ~200 | 3 |

#### Response

```json
{
  "plant_id": "plant_abc123",
  "preset": "standard",
  "created": {
    "areas": 4,
    "lines": 12,
    "assets": 48,
    "teams": 3,
    "users": 3
  }
}
```

---

### Option C: "Skip" (`setupMode: "skip"`)

No API call is made. The plant exists but has no operational data (no areas, lines, teams, or shifts). The user can set these up later from the plant dashboard.

---

## Validation Rules (Frontend)

These rules prevent the user from progressing to the next step:

| Step | Rule |
|------|------|
| 0 (Plant Details) | `plantName` must be non-empty |
| 2 (Lines) | At least 1 line, every line must have a non-empty `name` |
| 3 (Teams) | At least 1 team, every team must have a non-empty `name` |
| 3 (Teams) — custom mode | No time overlap between any two teams (rule: `start_B >= end_A` is OK, `start_B < end_A` is overlap) |
| 3 (Teams) — rotating/extended | No two teams can share the same `current_shift` value |
| 4 (Seed Data) | Always valid (skip is always available) |

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     ONBOARDING WIZARD                       │
├──────────┬──────────────────────────────────────────────────┤
│ Step 0   │  POST /admin/tenants/{tenantId}/plants          │
│          │  → creates plant record                         │
│          │  → returns plantId                              │
├──────────┼──────────────────────────────────────────────────┤
│ Steps 1–4│  (local React state only)                       │
│          │  areas, lines, teams collected                  │
│          │  saved to localStorage for resume               │
├──────────┼──────────────────────────────────────────────────┤
│ Step 5   │  User picks one of:                             │
│          │  ┌────────────────────────────────────────────┐ │
│          │  │ "Use My Setup"                             │ │
│          │  │ POST /admin/plants/{plantId}/setup         │ │
│          │  │ body: { areas, lines, teams, ... }         │ │
│          │  ├────────────────────────────────────────────┤ │
│          │  │ "Seed with Preset"                         │ │
│          │  │ POST /admin/plants/{plantId}/seed          │ │
│          │  │ body: { preset, include_demo_data }        │ │
│          │  ├────────────────────────────────────────────┤ │
│          │  │ "Skip"                                     │ │
│          │  │ (no API call)                              │ │
│          │  └────────────────────────────────────────────┘ │
├──────────┼──────────────────────────────────────────────────┤
│ Step 6   │  Review — display only, "Done" button           │
│          │  clears localStorage, navigates to dashboard    │
└──────────┴──────────────────────────────────────────────────┘
```

---

## Endpoints to Implement

### `POST /admin/plants/{plantId}/setup`

**New endpoint.** Receives wizard-configured data and creates the operational structure.

**Request body:**

```json
{
  "areas": [{ "name": "string", "description": "string" }],
  "lines": [{ "name": "string", "areaIndex": "number" }],
  "teams": [{
    "name": "string",
    "shift_config": "ShiftConfig (see above)",
    "current_shift": "string (optional)",
    "assigned_line_indices": ["number[] (optional)"]
  }],
  "globalShiftType": "string",
  "customShiftName": "string",
  "lineShiftMode": "all | per_line"
}
```

**Response:**

```json
{
  "plant_id": "string",
  "created": { "areas": "number", "lines": "number", "teams": "number" }
}
```

**Implementation notes:**

- `areaIndex` in `lines` is a 0-based index into the `areas` array. Resolve it to the actual area ID when creating line records.
- For `rotating` and `extended_rotating` shift types, the `hours` config defines the time windows. The `current_shift` tells you which position each team is currently on. Use this to generate the initial shift schedule.
- For `regular_day`, create a single shift per team with the `start_hour`/`end_hour`.
- All times are in 24-hour format (0–23). For example, `7` = 7:00 AM, `19` = 7:00 PM.
- Night shifts may cross midnight (e.g., `night: { start: 22, end: 6 }` means 10 PM to 6 AM).
- `assigned_line_indices` on each team maps to specific lines by index. Empty array or omitted = team covers all lines. Non-empty = create shift patterns scoped to those lines (set `line_id` on each shift pattern).
- `lineShiftMode: "all"` = shifts apply to all lines. `"per_line"` = shifts are scoped per line using `assigned_line_indices`.

---

## localStorage Resume

The wizard saves state to `localStorage` under key `optilog.onboarding.v1` with a 24-hour TTL. On return, the user is prompted to resume or start fresh. The saved state includes:

```json
{
  "tenantId": "string",
  "step": "number (0–5)",
  "data": "WizardData (full state)",
  "plantId": "string (set after step 0)",
  "savedAt": "number (timestamp)"
}
```

Resume is only offered if:
- `tenantId` matches the current tenant
- `step > 0` (plant must have been created)
- `savedAt` is within 24 hours

---

## Changelog

| Date | Change | Breaking? |
|------|--------|-----------|
| 2026-09-09 | **Line-to-team assignment.** Added `assigned_line_indices` field to `TeamData`. Teams can now be assigned to specific lines via checkboxes in the TeamsStep. Empty array = all lines. Non-empty = shift patterns scoped to those lines. `lineShiftMode` controls whether assignment is visible ("per_line") or hidden ("all"). | No — field is optional, defaults to all lines |
