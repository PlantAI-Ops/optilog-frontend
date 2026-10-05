# Shift Configuration — Backend Integration Guide

## Overview

The onboarding wizard (Step 4: Teams) now sends structured shift configuration data
instead of a flat string. The backend must accept and store this new format when
creating teams via the seed endpoint or team creation API.

---

## Frontend Type: `ShiftConfig`

```typescript
type ShiftConfig =
  | { type: "regular_day"; start_hour: number; end_hour: number; weekdays_only: boolean }
  | { type: "extended_day"; start_hour: number; end_hour: number }
  | { type: "night"; start_hour: number; end_hour: number }
  | { type: "rotating"; pattern: "2-2-2-2" | "3-3-3-3"; hours: ShiftHours };

interface ShiftHours {
  morning: { start: number; end: number };
  afternoon: { start: number; end: number };
  night: { start: number; end: number };
}
```

## Frontend Type: `TeamData`

```typescript
interface TeamData {
  name: string;
  shift_config: ShiftConfig;
}
```

---

## Shift Types

### 1. `regular_day`
Standard weekday day shift.

| Field | Default | Description |
|-------|---------|-------------|
| `type` | `"regular_day"` | Fixed identifier |
| `start_hour` | `8` | Shift start (24h format) |
| `end_hour` | `17` | Shift end (24h format) |
| `weekdays_only` | `true` | If `true`, Mon–Fri only. If `false`, includes weekends. |

### 2. `extended_day`
12-hour day shift, 7 days/week.

| Field | Default | Description |
|-------|---------|-------------|
| `type` | `"extended_day"` | Fixed identifier |
| `start_hour` | `7` | Shift start |
| `end_hour` | `19` | Shift end |

### 3. `night`
12-hour night shift, 7 days/week.

| Field | Default | Description |
|-------|---------|-------------|
| `type` | `"night"` | Fixed identifier |
| `start_hour` | `19` | Shift start |
| `end_hour` | `7` | Shift end (next day) |

### 4. `rotating`
Continental-style rotating shift with configurable time blocks.

| Field | Default | Description |
|-------|---------|-------------|
| `type` | `"rotating"` | Fixed identifier |
| `pattern` | `"2-2-2-2"` or `"3-3-3-3"` | Rotation cycle |
| `hours` | See below | Time blocks for each shift |

**Pattern descriptions:**
- **2-2-2-2**: 2 mornings → 2 afternoons → 2 nights → 2 off → repeat
- **3-3-3-3**: 3 mornings → 3 afternoons → 3 nights → 3 off → repeat

**Default `hours`:**
```json
{
  "morning":   { "start": 6,  "end": 14 },
  "afternoon": { "start": 14, "end": 22 },
  "night":     { "start": 22, "end": 6 }
}
```

---

## API Changes Required

### Seed Endpoint (`POST /api/v1/admin/plants/{plant_id}/seed`)

The seed request now includes `shift_config` per team instead of a flat `shift_pattern`.

**Current request shape (teams are part of the seed):**
```json
{
  "preset": "standard",
  "include_demo_data": false,
  "teams": [
    {
      "name": "Alpha Team",
      "shift_config": {
        "type": "regular_day",
        "start_hour": 8,
        "end_hour": 17,
        "weekdays_only": true
      }
    },
    {
      "name": "Bravo Team",
      "shift_config": {
        "type": "rotating",
        "pattern": "2-2-2-2",
        "hours": {
          "morning":   { "start": 6,  "end": 14 },
          "afternoon": { "start": 14, "end": 22 },
          "night":     { "start": 22, "end": 6 }
        }
      }
    }
  ]
}
```

> **Note:** If the `teams` field is not provided in the seed request, the backend should
> generate default teams using `regular_day` (8–17, weekdays only) based on the preset
> team count.

### Team Creation Endpoint (`POST /api/v1/plants/{plant_id}/teams`)

If teams can be created individually (outside the seed flow), the same `shift_config`
shape should be accepted.

**Request body:**
```json
{
  "name": "Alpha Team",
  "shift_config": {
    "type": "rotating",
    "pattern": "2-2-2-2",
    "hours": {
      "morning":   { "start": 6,  "end": 14 },
      "afternoon": { "start": 14, "end": 22 },
      "night":     { "start": 22, "end": 6 }
    }
  }
}
```

---

## Database Schema Change

### `teams` collection

**Add field:** `shift_config` (object)

```json
{
  "_id": ObjectId,
  "plant_id": ObjectId,
  "name": "Alpha Team",
  "supervisor": "string",
  "headcount": 0,
  "shift_config": {
    "type": "regular_day",
    "start_hour": 8,
    "end_hour": 17,
    "weekdays_only": true
  },
  "created_at": datetime
}
```

**For rotating shifts:**
```json
{
  "shift_config": {
    "type": "rotating",
    "pattern": "2-2-2-2",
    "hours": {
      "morning":   { "start": 6,  "end": 14 },
      "afternoon": { "start": 14, "end": 22 },
      "night":     { "start": 22, "end": 6 }
    }
  }
}
```

**Migration for existing teams:**
Existing teams with no `shift_config` should default to:
```json
{
  "type": "regular_day",
  "start_hour": 8,
  "end_hour": 17,
  "weekdays_only": true
}
```

---

## Backend Python Schema

```python
from pydantic import BaseModel
from typing import Union

class ShiftHours(BaseModel):
    morning: dict   # {"start": 6, "end": 14}
    afternoon: dict  # {"start": 14, "end": 22}
    night: dict      # {"start": 22, "end": 6}

class RegularDayConfig(BaseModel):
    type: str = "regular_day"
    start_hour: int = 8
    end_hour: int = 17
    weekdays_only: bool = True

class ExtendedDayConfig(BaseModel):
    type: str = "extended_day"
    start_hour: int = 7
    end_hour: int = 19

class NightConfig(BaseModel):
    type: str = "night"
    start_hour: int = 19
    end_hour: int = 7

class RotatingConfig(BaseModel):
    type: str = "rotating"
    pattern: str  # "2-2-2-2" or "3-3-3-3"
    hours: ShiftHours

ShiftConfig = Union[RegularDayConfig, ExtendedDayConfig, NightConfig, RotatingConfig]

class TeamCreate(BaseModel):
    name: str
    shift_config: ShiftConfig = RegularDayConfig()
```

---

## Summary for Backend Team

1. **Update `TeamCreate` schema** to accept `shift_config` (discriminated union on `type`)
2. **Update seed service** to pass `shift_config` through to team creation
3. **Add `shift_config` field** to the `teams` MongoDB collection
4. **Migration:** Set default `shift_config` for existing teams without one
5. **No breaking changes:** The `shift_config` field has a default, so existing API calls without it will still work
