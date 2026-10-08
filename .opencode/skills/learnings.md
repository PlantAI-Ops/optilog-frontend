# Learnings — Frontend Engineering

Chronological log of decisions, patterns, and gotchas discovered during development. Append-only — never delete entries.

---

## 2026-08-18: Dashboard wired to live backend

**Context:** Connected the console dashboard (`/console/`) to the 10 new backend endpoints, replacing all hardcoded seed data.

**Decisions:**
- Created `src/lib/hooks.ts` as the central location for all React Query hooks
- All hooks follow the same pattern: `useQuery` with `enabled: !!plantId`, `staleTime: 30_000`, query key `["dashboard", plantId, resource, ...params]`
- Plant ID comes from `useShiftLog().user?.plant_ids?.[0]` — the first plant in the user's list
- API responses include resolved names (`team_name`, `line_name`) so no client-side lookups needed
- Kept `ops-model.ts` types — they're still used for TypeScript interfaces elsewhere
- ConsoleShell accepts optional `plantName` prop with fallback to hardcoded value

**Gotchas:**
- localStorage hydration overrides seed data defaults — if `carriedOver: []` was saved previously, the hardcoded 3 items won't show
- The `User` type has `plant_ids: string[]` — always use `[0]` for single-plant views, or let user select in future
- React Query provider was wired up in `__root.tsx` but completely unused before this — the plumbing existed but no hooks called `useQuery`

**Pattern: Dashboard hook**
```ts
export function usePlantSummary(plantId: string | undefined, date: string) {
  return useQuery({
    queryKey: ["dashboard", plantId, "summary", date],
    queryFn: () => api.get<PlantSummary>(`/plants/${plantId}/summary?date=${date}`),
    enabled: !!plantId,
    staleTime: 30_000,
  });
}
```

---

## 2026-08-18: StartShiftScreen changed to "Start Logging"

**Context:** Operator flow simplified — button no longer calls the `startShift()` API endpoint.

**Decisions:**
- `handleStart` just does `setState({ shiftActive: true })` — local state transition only
- Removed `async`, `try/catch`, `loading` state, `disabled`, and spinner from the button
- `startShift()` function in `shift-log.ts` kept intact — available for future use
- Events will save to localStorage but won't sync to backend until `shiftId` exists

**Gotchas:**
- Without `startShift()` being called, `state.shiftId` stays `null`
- `addEvent()` checks `if (!state.shiftId)` and skips API sync — events stay local only
- This is intentional for now — the "Start Logging" button is about capturing events, not starting a backend shift

---

## 2026-08-18: Two separate data surfaces

**Context:** The app has two completely disconnected data flows.

**Architecture:**
1. **Mobile capture app** — `shift-log.ts` store with `useSyncExternalStore`, direct `api.*` calls, localStorage persistence, offline-first
2. **Desktop console** — React Query hooks, no local state caching, server-state-only

**Pattern:** Never mix these. Mobile state is for operators on the floor. React Query is for the console dashboard. They share the same API client (`api.ts`) but nothing else.

---

## 2026-08-18: Build produces three outputs

**Context:** Understanding the build pipeline.

**Details:**
- `npm run build` runs `vite build` which produces:
  1. Client bundle (`.output/public/assets/`)
  2. SSR bundle (`.output/server/_ssr/`)
  3. Nitro server bundle (`.output/server/`)
- All three must succeed for the build to pass
- Build time is typically 7-10 seconds total
- The Nitro preset is `cloudflare-module` — deployment target is Cloudflare Workers

---

## 2026-08-18: TypeScript strict mode is very strict

**Context:** The tsconfig enables flags beyond `strict: true`.

**Flags enabled:**
- `noUncheckedIndexedAccess` — array/object indexing returns `T | undefined`
- `exactOptionalPropertyTypes` — optional props can't be `undefined` unless explicitly allowed
- `noPropertyAccessFromIndexSignature` — must use bracket notation for dynamic keys
- `noImplicitOverride` — `override` keyword required when overriding methods
- `noImplicitReturns` — all code paths must return

**Impact:** When accessing API response data, always use optional chaining (`data?.field`) and nullish coalescing (`data?.field ?? defaultValue`).

---

## 2026-08-18: Shifts page wired to live backend

**Context:** Connected the shifts explorer (`/console/shifts`) to live data with date filtering.

**Decisions:**
- Added `useShiftEvents(plantId, shiftId)` hook — new endpoint needed: `GET /plants/{id}/shifts/{shiftId}/events`
- Reused existing `useShifts(plantId, date)` hook from dashboard work
- Added date filter bar with presets (Today, Yesterday, Last 7 days) + date input
- Auto-selects first shift in list when date changes
- Kept `SOURCE_LABEL` and `STATUS_LABEL` from `ops-model.ts` — these are display constants, not data
- Added loading/error/empty states for both shift list and event list

**Pattern: Date filter presets**
```ts
const PRESETS = [
  { label: "Today", value: todayStr() },
  { label: "Yesterday", value: daysAgo(1) },
  { label: "Last 7 days", value: daysAgo(6) },
] as const;
```

**Gotchas:**
- `shiftEvents.data?.length` returns `undefined` while loading, not `0` — always check `isLoading` first
- The existing `EventRow` type from dashboard hooks works for shift events too — no new types needed
- `STATUS_LABEL[e.status as keyof typeof STATUS_LABEL]` cast needed because API returns `string`, not the union type

---

## 2026-08-18: Skill enforces commit-after-build

**Context:** Updated the frontend engineer skill to make committing a required step after every successful build, not optional.

**Decision:**
- Changed workflow step 5 from "only commit when explicitly asked" to "commit immediately after build passes"
- Added git path for GitHub Desktop bundled git: `"C:\Users\MY PC\AppData\Local\GitHubDesktop\app-3.6.4\resources\app\git\cmd\git.exe"`

**Gotcha:**
- `.opencode/*` is in `.gitignore` — had to add `!.opencode/skills/` exception to track skill files

---

## 2026-08-18: Teams page wired to live backend

**Context:** Connected the teams performance page (`/console/teams`) to live data with date filtering.

**Decisions:**
- Reused 4 existing hooks: `useTeams`, `useTeamsSummary`, `useShifts`, `useAssetRollup`
- Client-side filtering of shifts by `team_id` — no new backend endpoint needed
- Built a `summaryMap` (Map keyed by `team_id`) from `useTeamsSummary` response for O(1) lookups per team card
- Added same date filter pattern as shifts page (presets + date input)
- `ShiftRow` already includes `achievement`, `team_name`, `line_name` — no computed fields needed

**Pattern: Map for O(1) lookup**
```ts
const summaryMap = new Map(teamsSummary.data?.map((t) => [t.team_id, t]) ?? []);
// Then per team: summaryMap.get(team.id)
```

**Gotcha:**
- `useShifts` returns all shifts — must filter by `s.team_id === team.id` for each card
- `achievement` is pre-computed in `ShiftRow` from the backend — no need to recalculate

---

## 2026-08-18: Events page wired to live backend

**Context:** Connected the events stream page (`/console/events`) to live data with type/source filters.

**Decisions:**
- Expanded `EventRow` type with full detail fields: `observation`, `reported_cause`, `verified_cause`, `action`, `source_record_id`, `evidence[]`, `incident_id`, `asset_name`
- Added `type` and `source` filter params to `useEvents` hook using `URLSearchParams`
- Changed `useEvents` third arg from `limit?: number` to `opts?: { limit?, type?, source? }` — updated dashboard call accordingly
- Used `SOURCE_LABEL[e.source as keyof typeof SOURCE_LABEL] ?? e.source` cast for API strings vs union types
- Server-side filtering — backend filters by type/source, not client-side

**Pattern: URLSearchParams for clean query building**
```ts
const params = new URLSearchParams({ date });
if (opts?.limit) params.set("limit", String(opts.limit));
if (opts?.type && opts.type !== "all") params.set("type", opts.type);
```

**Gotcha:**
- Changing `useEvents` signature required updating the dashboard call from `useEvents(plantId, today, 5)` to `useEvents(plantId, today, { limit: 5 })`
- `as keyof typeof` cast needed because API returns `string`, not the union type from `ops-model.ts`

---

## 2026-08-18: RCA page wired to live backend

**Context:** Connected the root cause analysis page (`/console/rca`) to live data.

**Decisions:**
- Expanded `IncidentRow` type with full detail fields: `shift_id`, `date`, `problem`, `observed_condition`, `root_cause`, `five_why[]`, `corrective_action`, `preventive_action`, `timeline[]`, `evidence[]`, `event_ids[]`, `ai_insight`
- Added `useIncidentEvents(plantId, incidentId)` hook — new endpoint: `GET /plants/{id}/incidents/{incidentId}/events`
- Auto-selects first incident in list on load (no need to click first)
- Linked events section has its own loading state via `useIncidentEvents`
- Shift display uses a simple fallback (`Shift {id}`) since we don't have shift data readily available in the incident response

**Pattern: Auto-select first item**
```ts
const selectedId = id ?? incidents.data?.[0]?.id;
```

**Gotcha:**
- `timeline` and `evidence` items have `source` as `string` — need `as keyof typeof SOURCE_LABEL` cast for the badge display
- The `five_why` array may have empty question/answer pairs — always show fallback text

---

## 2026-08-18: RCA fully separated from incidents

**Context:** RCA is now a separate entity with its own CRUD + approve endpoints, not embedded fields in the incident.

**Decisions:**
- Shrunk `IncidentRow` — removed all embedded RCA fields (problem, five_why, corrective_action, etc.)
- Added `RCARow` type with full investigation fields + status + timestamps
- Added 4 mutation/query hooks: `useIncidentRCA`, `useCreateRCA`, `useUpdateRCA`, `useApproveRCA`
- Mutations use `useQueryClient` to invalidate the RCA query on success
- RCA page shows "Start Investigation" when no RCA exists, editable fields + save/approve when it does
- Editing mode uses local `form` state — only submits on save, not real-time

**Pattern: Mutation with cache invalidation**
```ts
export function useCreateRCA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ incidentId, data }) => api.post(`/incidents/${incidentId}/rca`, data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["rca", vars.incidentId] });
    },
  });
}
```

**Gotcha:**
- `useCreateRCA` needs the `incidentId` in the mutation variables — use `onSuccess: (_res, vars)` where `vars` is the mutation input
- RCA status flow: `draft` → (edit) → `completed` → `approve` → `approved`

---

## 2026-08-18: Breakdown event type + supervisor RCA creation from events

**Context:** Added "breakdown" as a new event type and enabled supervisors+ to create RCA directly from breakdown events on the events page.

**Decisions:**
- Added `"breakdown"` to `EventType` union in `ops-model.ts`
- Added `breakdown` to the `TYPES` filter array and `filterLabel()` in `events.tsx`
- Created `useCreateIncident` mutation hook — `POST /plants/{plantId}/incidents` with `{ event_id, title }`
- Events page checks `hasMinRole(user?.role, "supervisor")` to gate the "Create RCA" button
- "Create RCA" button only appears on expanded breakdown events that don't already have an `incident_id`
- Button calls `createIncident.mutate()` then navigates to `/console/rca` via `useNavigate()`
- New incident auto-appears in RCA sidebar since `useIncidents` is already cached/invalidated

**Pattern: Role-gated UI with hasMinRole**
```ts
const canCreateRCA = hasMinRole(user?.role ?? "operator", "supervisor");
// In JSX: {e.event_type === "breakdown" && canCreateRCA && !e.incident_id ? (button) : null}
```

**Pattern: Mutation + navigation**
```ts
createIncident.mutate(
  { plantId, data: { event_id: e.id, title: e.description } },
  { onSuccess: () => navigate({ to: "/console/rca" }) },
);
```

**Gotchas:**
- `hasMinRole` is exported from `shift-log.ts` — import it alongside `useShiftLog`
- The `useCreateIncident` hook invalidates `["dashboard", plantId, "incidents"]` so the RCA page sidebar updates
- Must pass `plantId` in mutation vars (not just `event_id`) because the endpoint is plant-scoped
- Other modified files in the working tree (AppShell.tsx, end-shift.tsx, etc.) were NOT committed — only the 3 relevant files were staged

---

## 2026-08-19: Combined endpoint for breakdown RCA creation

**Context:** Replaced two-step flow (create incident → start investigation) with single combined endpoint.

**Decisions:**
- Replaced `useCreateIncident` (`POST /plants/{plantId}/incidents`) with `useCreateRCAFromEvent` (`POST /rca/events/{eventId}/rca`)
- New hook only needs `eventId` — no `plantId` or `data` body required
- Button handler simplified: `createRCAFromEvent.mutate({ eventId: e.id })` → navigate to `/console/rca`
- Invalidates `["dashboard", "incidents"]` so RCA page sidebar picks up the new incident

**Pattern: Event-scoped mutation (no plantId)**
```ts
export function useCreateRCAFromEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId }: { eventId: string }) =>
      api.post<RCARow>(`/rca/events/${eventId}/rca`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "incidents"] });
    },
  });
}
```

**Gotcha:**
- The old `useCreateIncident` hook is no longer used — if no other page references it, it can be removed from hooks.ts in future cleanup

---

## 2026-08-19: Create RCA dropdown on RCA page

**Context:** Added a "Create RCA" dropdown in the RCA page sidebar header, allowing supervisors to create incident + RCA from breakdown events without leaving the page.

**Decisions:**
- Reused `useEvents(plantId, today, { type: "breakdown" })` hook — no new backend endpoint needed
- Client-side filtered `unlinkedBreakdowns = events.data?.filter(e => !e.incident_id)` — breakdowns are a small subset, local filter is fine
- Dropdown uses `useRef` + relative positioning for click-outside detection (though click-outside isn't implemented yet — dropdown closes on selection)
- After successful creation, calls `incidents.refetch()` to update the sidebar immediately
- Role-gated with `hasMinRole(user?.role, "supervisor")` — dropdown only visible to supervisors+
- Added `ref` import from React for dropdown ref

**Pattern: Dropdown in sidebar header**
```tsx
<header className="flex items-center justify-between ...">
  Incidents
  {canCreateRCA ? (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setDropdownOpen(o => !o)}>
        <Plus /> Create RCA <ChevronDown />
      </button>
      {dropdownOpen ? (
        <div className="absolute right-0 top-full z-10 ...">
          {/* dropdown content */}
        </div>
      ) : null}
    </div>
  ) : null}
</header>
```

**Gotcha:**
- The dropdown doesn't close on click-outside yet — only on selection or toggle. Could add a `useEffect` with `mousedown` listener if needed.
- `incidents.refetch()` is called after creation rather than relying on cache invalidation alone — ensures the sidebar updates immediately even if the invalidation is slow

---

## 2026-08-19: Backend API spec alignment + plant name + auth redirect

**Context:** Audited all frontend hooks against the finalized backend API reference and fixed mismatches.

**Fixes applied:**

1. **RCA endpoint paths** — Added missing `/rca/` prefix:
   - `useIncidentRCA`: `/incidents/{id}/rca` → `/rca/incidents/{id}/rca`
   - `useCreateRCA`: `/incidents/{id}/rca` → `/rca/incidents/{id}/rca`
   - `useUpdateRCA`, `useApproveRCA`, `useCreateRCAFromEvent` were already correct

2. **Approve button** — Removed `|| rca.data.status === "draft"` from condition. Backend workflow: `draft → in_progress → completed → approved`. Approve only at `completed`.

3. **`environmental` event type** — Added to `EventType` union in `ops-model.ts`, `TYPES` filter, and `filterLabel()` in `events.tsx`

4. **Dead code** — `useCreateIncident` was already removed in prior commit

5. **Plant name** — ConsoleShell now fetches plant data via `usePlant(plantId)` hook (`GET /plants/{plantId}`) instead of using hardcoded `"Ikeja Plant"` from seed data

6. **Auth redirect** — `api.ts` now calls `clearToken()` and redirects to `/` on 401 responses

**Pattern: Auto-fetch plant name in shell**
```ts
// ConsoleShell.tsx
const user = useShiftLog().user;
const plantId = user?.plant_ids?.[0];
const plant = usePlant(plantId);
const displayName = plantName ?? plant.data?.name ?? "—";
```

**Pattern: 401 redirect in API client**
```ts
if (res.status === 401) {
  clearToken();
  if (typeof window !== "undefined") window.location.href = "/";
}
```

**Gotchas:**
- `usePlant` uses `staleTime: 300_000` (5 min) since plant name rarely changes
- The backend auth response doesn't include `plant_name` — only `plant_ids`, so a separate fetch is required
- `api.ts` was previously untracked in git (in `.gitignore` or just never added) — this commit added it as a new tracked file
- `plant` import from `ops-model.ts` in ConsoleShell was removed — the hardcoded seed plant is no longer used anywhere in the console

---

## 2026-08-19: Integrations + Data Model pages wired to live backend

**Context:** Connected the remaining two console pages (Integrations, Data Model) to live backend endpoints, completing all console page wiring.

**Decisions:**
- Created `usePlantConnectors` hook — `GET /plants/{id}/connectors`, returns `ConnectorRow[]` with health, direction, kind, mapping
- `useAreas`, `useLines`, `useAssets` hooks already existed — reused without changes
- Integrations page uses `ConnectorRow` type (matches existing `Connector` interface shape from `ops-model.ts`)
- Data page shows asset hierarchy tree from live data — area → line → asset nested structure
- Both pages use `useShiftLog().user?.plant_ids?.[0]` for plantId, same pattern as all console pages
- Added loading spinners for both pages using `Loader2` from lucide-react

**Pattern: Reuse existing hooks**
```ts
// Already existed in hooks.ts — no new code needed
export function useAreas(plantId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", plantId, "areas"],
    queryFn: () => api.get<Area[]>(`/plants/${plantId}/areas`),
    enabled: !!plantId,
    staleTime: STALE_TIME,
  });
}
```

**Pattern: Auto-select first connector**
```ts
const [id, setId] = useState<string | undefined>(undefined);
const connector = connectors.find((c) => c.id === id) ?? connectors[0];
// Auto-select first item after data loads
if (id === undefined && connectors.length > 0) {
  setId(connectors[0]!.id);
}
```

**Gotchas:**
- `SOURCE_LABEL` lookup needs fallback: `SOURCE_LABEL[connector.system] ?? connector.system.toUpperCase()` — API returns strings that may not be in the static map
- Integrations page is documentation-heavy — the inbound/normalised payload code cards are static, not fetched from backend
- Data page's event schema and outbound endpoints are also documentation — only the asset hierarchy tree is live data
- All console pages are now wired to live backend — only RecordShift (mobile) remains blocked on backend endpoints

**Console page wiring status:**
- ✅ Dashboard — wired
- ✅ Shifts — wired
- ✅ Teams — wired
- ✅ Events — wired
- ✅ RCA — wired
- ✅ Integrations — wired (this commit)
- ✅ Data Model — wired (this commit)

---

## 2026-08-19: Mobile flow wired to live backend (STT + shift options + audio)

**Context:** Connected the entire mobile operator flow to live backend endpoints — shift selection, voice recording with STT, and audio playback.

**Endpoints implemented:**
1. `GET /plants/{id}/shifts/options?date=` — shift types + lines for dropdown
2. `GET /plants/{id}/shifts/carried-over?date=&shift_id=` — previous shift issues
3. `POST /recordings/speech-to-text` — Gemini STT + Groq extraction
4. `GET /shifts/{id}/events/{id}/audio` — presigned URL for playback
5. `POST /recordings` — save audio recording on confirm

**Changes:**

1. **`api.ts`** — Added `postFormData()` function for multipart/form-data uploads (speech-to-text, recording save)

2. **`hooks.ts`** — Added 4 new exports:
   - `useShiftOptions(plantId, date)` — fetches available shifts + lines
   - `useCarriedOver(plantId, date, shiftId)` — fetches unresolved issues
   - `useEventAudio(shiftId, eventId)` — fetches presigned audio URL
   - `transcribeAudio(audioBlob, plantId, shiftId)` — one-shot function (not a hook)

3. **`shift-log.ts`** — Type changes:
   - Added `recording_id?: string` to `ShiftEvent`
   - Added `lineId: string | null` to `ShiftState`
   - Updated `initialState` with `lineId: null`
   - Removed `SAMPLES` array and `structureRecording()` function (sample data)
   - Kept `blankEvent()` for manual entry fallback

4. **`routes/index.tsx`** — StartShiftScreen:
   - Replaced static display with dropdowns for shift and line selection
   - Fetches options from `useShiftOptions(plantId, today)`
   - Auto-fetches carried-over issues when shift is selected
   - `handleStart()` stores `shiftId`, `shiftName`, `lineId`, `line` in state
   - Button disabled until both dropdowns are selected

5. **`routes/index.tsx`** — RecordScreen:
   - Added Web Speech API integration for live transcript preview during recording
   - Added `MediaRecorder` to capture audio blob (webm format)
   - `startRecording()`: starts both MediaRecorder and Web Speech API
   - `stopRecording()`: stops both, sends audio to `POST /recordings/speech-to-text`
   - Uses backend result (transcript + structured_event) for confirm phase
   - Falls back to Web Speech preview if backend fails
   - `commit()`: saves audio to `POST /recordings` if user confirms
   - Shows live transcript preview while recording
   - Processing message changed from "Writing up your event…" to "Transcribing…"

6. **`routes/timeline.tsx`** — Audio playback:
   - Added `PlayAudioButton` component using `useEventAudio` hook
   - Plays audio from presigned URL when available
   - Only shows for events with `recording_id`
   - Shows loading state while fetching URL
   - Toggle play/pause functionality

**Architecture:**
- Web Speech API = browser-side, real-time preview, free, lower accuracy
- Backend STT = Gemini + Groq, accurate transcription + structured event extraction
- Hybrid approach = live preview for UX, backend result for accuracy
- POST /speech-to-text is stateless (no recording doc created) — fast response
- POST /recordings is called only on user confirm — saves audio to R2

**Gotchas:**
- `navigator.mediaDevices.getUserMedia` may fail if microphone access is denied — still allow manual entry
- Web Speech API is not supported in all browsers (Safari limited) — gracefully degrade
- `MediaRecorder` on Chrome defaults to `webm` format — backend accepts all formats
- Audio chunks accumulate in `audioChunksRef` — must clear on new recording
- `useEventAudio` has `staleTime: 3_600_000` (1 hour) since presigned URLs expire in 1 hour
- `structureRecording()` was removed — the RecordScreen now requires a working microphone or falls back to manual entry
- `postFormData` is a standalone function, not on the `api` object — imported separately from `@/lib/api`

**Mobile flow status:**
- ✅ Login → `POST /auth/login` + `GET /auth/me`
- ✅ StartShiftScreen → dropdowns for shift + line, carried-over from backend
- ✅ RecordScreen → voice recording + Web Speech API preview + backend STT
- ✅ TimelinePage → audio playback from presigned URL
- ✅ EndShiftPage → `POST /shifts/{shift_id}/end`
- ✅ ReportPage → local state only (no additional endpoints needed)

---

## 2026-08-19: Audio-reactive ring pulse (Google Meet style)

**Context:** Replaced static pulsing animation on the RECORD button with an audio-reactive ring that responds to microphone input in real-time.

**Architecture:**
- Web Audio API `AnalyserNode` reads frequency data from the mic stream at 60fps
- `requestAnimationFrame` loop calculates average audio level (0-1)
- Direct DOM manipulation via `buttonRef.current.style.boxShadow` — bypasses React for performance
- `box-shadow` spread + opacity driven by audio level — GPU-accelerated, matches Google Meet aesthetic

**Implementation:**
- `startAudioAnalyser(stream)` — creates `AudioContext`, `AnalyserNode`, connects mic stream, starts RAF loop
- `stopAudioAnalyser()` — cancels RAF, closes AudioContext, clears refs
- `buttonRef` on the big RECORD button for direct DOM access
- Removed `record-pulse` CSS class — replaced with dynamic `box-shadow`

**Key parameters:**
- `fftSize = 64` — 32 frequency bins, enough for smooth animation
- `smoothingTimeConstant = 0.8` — smooths the ring pulse (not jittery)
- `baseSpread = 8px`, `maxSpread = 35px` — range of ring thickness
- `baseOpacity = 0.2`, `maxOpacity = 0.8` — range of ring opacity
- Color: `rgba(239, 68, 68)` — matches the existing `--record` color (red)

**Pattern: Direct DOM in RAF loop**
```ts
const updateRing = () => {
  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  const level = avg / 255;
  if (buttonRef.current) {
    const spread = 8 + level * 35;
    const opacity = 0.2 + level * 0.6;
    buttonRef.current.style.boxShadow = `0 0 ${spread}px rgba(239, 68, 68, ${opacity})`;
  }
  rafIdRef.current = requestAnimationFrame(updateRing);
};
```

**Gotchas:**
- `AudioContext` may be suspended until user gesture — but `getUserMedia` prompt counts as a gesture
- `webkitAudioContext` fallback needed for older Safari
- `cancelAnimationFrame` must be called in cleanup — prevents memory leaks
- `buttonRef.current.style.boxShadow` is reset to `""` on stop — removes the ring
- Cleanup on unmount via `useEffect` return function — prevents stale refs
- No React state updates in the RAF loop — direct DOM manipulation only for 60fps

---

## 2026-08-19: StartShiftScreen rewritten for auto-detected shift

**Context:** Backend now auto-detects the current shift based on plant timezone, hour, and day of week. No shift dropdown needed — operator only selects their line.

**Decisions:**
- Replaced `useShiftOptions(plantId, today)` with `useCurrentShift(plantId)` — returns `current_shift` + `lines`
- Removed shift dropdown entirely — shift info displayed as read-only text (name, time, team)
- Kept line dropdown — operator still selects their production line
- Updated `useCarriedOver` call signature from `(plantId, date, shiftId)` to `(plantId, shiftType, date)` — uses `shift_type` string (e.g., "morning"), not ObjectId
- `handleStart()` now sets `shiftType` in state alongside `shiftId`, `shiftName`, `lineId`, `line`
- Carried-over issues are `CarriedOverIssue[]` objects — mapped to strings for `state.carriedOver`

**Pattern: Read-only info card with one dropdown**
```tsx
<div className="space-y-3 rounded-2xl border border-border bg-card p-4">
  <div className="flex justify-between">
    <dt className="text-muted-foreground">Shift</dt>
    <dd className="font-bold">{shift.name} ({shift.start}–{shift.end})</dd>
  </div>
  <label className="block">
    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Production area</span>
    <select ...>{lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
  </label>
</div>
```

**Gotchas:**
- `useCarriedOver` has `enabled: !!plantId && !!shiftType` — won't fetch until shift is detected
- `currentShift.data?.current_shift` may be undefined while loading — always check `isLoading` first
- The old `useShiftOptions` hook was deleted — any remaining references cause `ReferenceError` at runtime
- `carriedOver.data?.open_issues` is `CarriedOverIssue[]`, not `string[]` — must map for display
- Backend must implement `GET /plants/{id}/shifts/current` for this to work — frontend provides the spec, backend implements

---

## 2026-09-26: DESIGN.md generated (impeccable document, scan mode)

**Context:** No DESIGN.md existed; PRODUCT.md did. Ran scan mode over the shipped code.

**Decisions:**
- Canonical colour format stays **OKLCH** (the CSS file mandates it). Frontmatter carries the exact oklch strings; prose never restates a different format.
- Documented the system as **two densities in one palette**: floor world (AppShell, max-w-md, rounded-2xl/3xl, 56-80px targets, weight 900) vs console world (ConsoleShell, rounded-xl/lg, 36px shadcn controls, weight 500-700).
- Creative North Star chosen with the user: "The Control Room at 3 a.m."; depth philosophy recorded as flat/border-defined.
- Colour names adopted: Safety Amber, Emergency Stop Red, Steel Black, Console Plate, Recessed Well, Slate Line, Ash Text, Signal White, Running Green, Caution Lamp, Fault Red.
- Real font stack recorded from `node_modules/tailwindcss/theme.css`: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif`. No webfont is loaded.
- Sidecar written to `.impeccable/design.json` (schemaVersion 2) with 17 colorMeta ramps (gamut-clamped OKLCH via script), 10 self-contained shadow-DOM component snippets, shadows/motion/breakpoints, and narrative mapped verbatim from DESIGN.md.

**Gotchas:**
- `bg-info` / `text-info` / `border-info` are used in `src/routes/index.tsx:208-209` but `--color-info` is **never defined** -- those Tailwind utilities silently do nothing. Recorded as a Don't in DESIGN.md; a code fix is still pending.
- The record puck's inline audio glow hardcodes `rgba(239, 68, 68, a)` instead of the `--record` token.
- `components.json` claims a full shadcn set, but outside `src/components/ui/` only `input`, `label`, `checkbox` and `calendar` are imported -- the real visual system is hand-rolled Tailwind in `src/routes` and the two shells.
- shadcn `Card` carries `border` + `shadow` together (Tailwind `shadow` = `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`); every other surface is border-only.
- **Never edit text files with PowerShell `Get-Content`/`Set-Content`** -- PS 5.1 re-encodes without a BOM and mangles every multi-byte character, plus leaves a UTF-8 BOM. It corrupted DESIGN.md once this session; the file was rewritten with the Write tool and the BOM stripped. Use the Write/Edit tools, or `.NET` byte APIs if you must script it.
- The Write tool also emits a UTF-8 BOM, which must be stripped from files that start a YAML/JSON document (some parsers reject it).

---

## 2026-09-26: Critique of `src/routes/console/admin` + P0 wizard hardening

**Context:** First `impeccable critique` run for this target (slug `src-routes-console-admin`). Score **19/40 (Poor)**. Two isolated sub-agents (A: design review, B: detector); browser overlay skipped — no browser automation in this session. Snapshot: `.impeccable/critique/2026-09-26T21-39-51Z__src-routes-console-admin.md`.

**Decisions (P0 data safety, `harden`):**
- Wizard step 0 now **updates instead of re-creating**: `handleNext` branches on `plantId` and PATCHes via `useUpdatePlant` (the hook already existed in `admin-hooks.ts` and was imported by nothing).
- Added `setupApplied` to `WizardData` (persisted through localStorage resume). Once config/preset seeding succeeds, `handleNext` at step 4 short-circuits to step 5 and **Back is disabled** — no re-seed, no re-apply.
- `handleStartFresh` **keeps** an existing `plantId` instead of nulling it: nulling made "Start Fresh" the new duplicate-plant path, since the next step-0 Next would POST again. Non-destructive beats an unconfirmed delete.
- "Skip" mode deliberately does NOT set `setupApplied`, so the user can still go Back and pick a real mode (nothing was written).

**Gotchas:**
- `tsc --noEmit` has **pre-existing** failures in `src/routes/console/integrations.tsx` (TS7053) and `src/routes/index.tsx` (SpeechRecognition types) — unrelated to this work; do not treat as a regression.
- The file had pre-existing prettier drift; `npx eslint <file>` fails the build on it. Run `npx prettier --write <file>` on any file you touch here, then re-lint.
- Repo temp-dir gotcha: `C:\Users\MY PC~1\...` (with a space) does not resolve; `$env:TEMP` gives `C:\Users\MYPC~1\AppData\Local\Temp`, and `Remove-Item -LiteralPath` on that short path fails — use `[System.IO.File]::Delete()`.
- The whole wizard resume/seed-config feature was already uncommitted before this session, so `git diff` on `OnboardingWizard.tsx` shows far more than the hardening changes. Do not commit unless asked.

---

## 2026-10-01: Mass import clobbering from ClientOnly hydration fixes

**Context:** A previous edit wave added `ClientOnly` wrappers and `useFormattedNumber`/`useFormattedTime` hooks to fix SSR/hydration mismatches across console pages. During those edits, entire import blocks were accidentally deleted/replaced in multiple files, leaving undefined identifiers that threw `ReferenceError` at render → root ErrorComponent → "This page didn't load".

**Root cause:** The edits kept the new `ClientOnly` imports but dropped 11-15 existing import lines per file. Vite build (`vite build`) does NOT run `tsc`, so these `TS2304: Cannot find name` errors never surfaced in CI/build — only at runtime in the browser.

**Files affected (TS2304 errors):**
- `src/routes/console/shifts.tsx` — lost 11 imports (`useState`, `Loader2`, `ConsoleShell`, `StatCard`, `SourceBadge`, `SOURCE_LABEL`, `STATUS_LABEL`, `ApiError`, `useShiftLog`, `useShiftEvents`, `useShifts`)
- `src/routes/console/calendar.tsx` — lost `format`, `startOfMonth` from `date-fns`
- `src/routes/console/maintenance.tsx` — lost `CalendarDays`, `CheckCircle2`, `ChevronLeft` from `lucide-react`
- `src/routes/console/index.tsx` — lost `formatNumber` from `@/lib/locale`
- `src/routes/console/integrations.tsx` — lost `useState` from `react`, `formatNumber` from `@/lib/locale`
- `src/routes/console/admin/$tenantId/index.tsx` — lost `Label`, `Input` from `@/components/ui`, `format` from `date-fns`
- `src/routes/console/admin/system/index.tsx` — lost `Badge` from `@/components/ui` + conditional hooks (early return before hooks)
- `src/routes/console/admin/system/tenant/$tenantId/index.tsx` — lost `format` from `date-fns`
- `src/components/admin/PlantSetupForm.tsx` — lost `Button` from `@/components/ui`

**Additional bugs found/fixed:**
1. **Conditional hooks (rules-of-hooks violation):** `src/routes/console/admin/system/index.tsx` had early return (`if (!user) return null`) BEFORE calling `useTenants()`, `useSystemStats()`, 6× `useState`, `useSystemUsers()` — moved after all hooks.
2. **Hook in JSX:** `src/routes/index.tsx:593` called `useFormattedTime()` inside JSX after early returns — replaced with non-hook `formatTime()` from `@/lib/locale`.
3. **StatCard type:** `value: string | number` too narrow for `ClientOnly` children — widened to `React.ReactNode`.
4. **Badge variants:** Added missing `success` and `warning` variants to `src/components/ui/badge.tsx`.
5. **Template literal JSX:** `shifts.tsx` `hint={`Target <ClientOnly>...</ClientOnly>`}` rendered as literal text — fixed to proper JSX element.
6. **PlantSetupForm `.data` misuse:** `useTenantPlants` returns `AdminPlant[]` directly (via `normalizeArrayResponse`), not an object with `.data` — fixed all accesses.
7. **SystemUsersResponse `.length`:** Response is `{ items, total, page, ... }`, not an array — use `.items?.length`.
8. **Pre-existing SpeechRecognition types:** Added ambient declarations inline in `src/routes/index.tsx` (4 errors).

**Guardrail added:** `npm run typecheck` script (`tsc --noEmit`) — run in CI or pre-commit to catch missing imports and type errors that `vite build` misses.

**Lesson:** When adding imports during a refactor, always verify the file still has ALL required imports. A grep for `Cannot find name` after `tsc --noEmit` would have caught this instantly. The `vite build` success is NOT a signal of type safety in this project.

---

## 2026-10-01: Login spinner stuck, pending-shift button blocked, backend aggregate 500s

**1. Sign-in button spun forever** (`src/lib/shift-log.ts`):
- `initialState.loading = true` and `restoreSession()` early-returned when no token existed **without clearing `loading`**. First visit = spinner + disabled button permanently.
- Fix: set `loading: false` before the early return, and force `loading: false` in `hydrate()` so a persisted `loading: true` (reload mid-request) can never resume.

**2. "Start Logging" dead for unscheduled operators** (`src/routes/index.tsx`):
- Verified against local backend: `/plants/{id}/shifts/current` returns a **pending** shift with `lines: []` when nobody is scheduled. The Production area `<select>` never rendered, so `selectedLineId` stayed `""` and `canStart = !!shift && !!selectedLineId` stayed false.
- Fix: `canStart = !!shift && (lines.length === 0 || !!selectedLineId)`; `handleStart` falls back to `shift.line_name || "Unassigned"`. Button label shows `Loading…` while the shift query is in flight.

**3. Backend 500s on shifts/rollup (+ misleading CORS errors):** fixed in `optilog-backend`:
- The backend uses pymongo's **native async API** (`AsyncMongoClient`), where `AsyncCollection.aggregate()` is a *coroutine* returning `AsyncCommandCursor`. All 9 call sites used the old Motor style (`cursor = coll.aggregate(p)` / `await cursor.to_list(n)`) → `AttributeError: 'coroutine' object has no attribute 'to_list'`.
- Unhandled 500s also bypass `CORSMiddleware` (Starlette's `ServerErrorMiddleware` is outermost), so the browser logged `No 'Access-Control-Allow-Origin' header` — a symptom, not the cause.
- Why tests missed it: `tests/conftest.py` uses `mongomock_motor`, whose `aggregate()` returns a cursor **synchronously**; awaiting it then fails. Fix is the compatibility helper `aggregate_list()` in `app/db/collections.py` (await only if `inspect.isawaitable`), used by all 9 sites in `dashboard/`, `shifts/`, `admin/` services.
- Repro recipe that found it: call the service function directly from a stdin-piped python script with `traceback.print_exc()` — the empty-body 500 gave no clue.
- Pre-existing unrelated failure: `tests/api/test_security.py::test_system_admin_can_grant_system_admin` (403 `Cannot grant this role` from WIP `can_grant_role` logic) — not caused by this work.


---

## 2026-10-02: Tenant admin panel opened to plant_manager/integration_admin

**Goal:** \/console/admin\ usable by plant_manager + integration_admin (own tenant only), with system-admin parity (members CRUD, role breakdown).

**Backend (\optilog-backend\):**
- \GET /admin/tenants/{id}\, \/tenants/{id}/users\, \/tenants/{id}/stats\ (new), \GET/POST /admin/users\, \GET/PATCH/DELETE /admin/users/{id}\: \equire_role("system_admin")\ → \equire_role("plant_manager")\ (rank ≥4 via \ROLE_HIERARCHY\).
- Service layer does the real scoping: \_check_tenant_access(user, tenant_id)\ (system_admin bypass), \list_all_users(..., caller)\ **pins non-system callers to their own tenant regardless of query params**, user CRUD checks the target user's \	enant_id\, \can_grant_role()\ (rank ≤, never system_admin) gates role changes. \update_user_admin\ pops \	enant_id\ for non-system callers (same-tenant no-op, cross-tenant 403).
- New \GET /admin/tenants/{id}/stats\ → \TenantStatsResponse\ (total/active users, plants, pending invites, \users_by_role\ via \ggregate_list\).
- Tests: 6 new cases in \	ests/api/test_cross_tenant_access.py\ + updated \	est_plant_manager_cannot_access_users\ → \..._can_access_users_scoped\. conftest tenant seeds needed \contact_email/trial_ends_at/max_users/max_plants/config\ or \TenantResponse\ validation 500s. Suite: 134 passed, 1 pre-existing failure (\	est_system_admin_can_grant_system_admin\).

**Frontend:**
- \dmin-hooks.ts\: \useTenants(enabled)\ (skip the system-admin-only list for scoped callers), \useTenantStats(tenantId)\. Existing \qc.invalidateQueries(["admin","tenants"])\ prefix already invalidates tenant users/stats — no mutation changes needed.
- \CreateUserModal\: new \	enantId\ prop locks the tenant (renders name, skips \useTenants()\), role options filtered by \hasMinRole(caller.role, option)\, **"send invitation" now branches to \POST /admin/tenants/{id}/invite\** — the old path sent \password: ""\ to \POST /admin/users\ which 422'd (\UserCreate.password\ min_length=8, backend never handled \send_invitation\).
- \UserEditModal\: tenant select + \useTenants()\ only for system_admin; role select rank-filtered and disabled when the target's role outranks the caller; payload only sends \ole\ when changed and \	enant_id\ only for system_admin (avoids 403 on untouched fields).
- \outes/console/admin/\/index.tsx\ rebuilt as 4 tabs (Overview stats + role breakdown / Members / Plants / Invitations) with a scope guard redirecting non-system users to \user.tenant_id\. \dmin/route.tsx\ gate (\≥ plant_manager\) unchanged.

**Gotchas:** \POST /admin/users\ still *requires* \	enant_id\ in the body (\UserCreate\ schema) — the service-level \or caller[tenant_id]\ fallback never fires from HTTP. Live smoke tests done with \	enant-admin@optilog.com\ (plant_manager, tenant \6abc31fd168d38a7d2ce0e37\).


---

## 2026-10-02: Plant IDs rendered as names in user tables

**Bug:** system_admin Admin -> Users showed raw ObjectIDs (`6abd9cd7...`) in the Plants column (src/components/admin/SystemUserTable.tsx:225); the edit modal's Plant Access chips had the same issue.

**Root cause:** `SystemUserTable` had no plant data at all (cross-tenant view - no `plants` prop), so it truncated ids. `TenantUserTable` never had this bug: it resolves via its `plants` prop (`plants.find(p => p.id === plantId)`).

**Fix (server-side resolution, mirrors the existing tenant_name pattern):**
- Backend `list_all_users` + `get_user_by_id_admin`: one extra `plants.find` by `_id $in ids` per page via helper `_plant_names_for_users()` -> attaches `user["plant_names"] = {plant_id: name}`. Dangling ids (deleted plants) are simply absent from the map.
- `UserResponse` schema gained `plant_names: Optional[dict[str, str]] = None` - required, or FastAPI's response_model silently strips the field.
- Frontend: `plant_names?: Record<string, string>` added to **both** `SystemUser` interfaces (shift-log.ts AND admin-hooks.ts - they are separate, duplicated types); render `user.plant_names?.[id] ?? id.slice(0,8)+"..."`.
- Also removed the raw `tenant_id.slice(0,8)` subtitle under the tenant name in SystemUserTable (user chose "name only").

**Pattern:** when a list view shows a foreign-key id, resolve the display name server-side in the list query rather than firing per-tenant fetches client-side (system admin views span all tenants -> client-side N+1).

---

## 2026-10-02: Server-driven Members tab, plant pickers, active=all

**Gaps closed (7-item audit):** tenant Members tab had client-side-only filters (inactive users invisible, >50 truncated, no pagination/search), edit-modal email was a silent no-op, plant assignment was display-only, `useSystemUsers` sent dead `limit` param, "All Status" was active-only, docs lacked `plant_names`/`active`.

**Frontend:**
- `admin-hooks.ts`: new `UserListParams`/`UserListFilters` types + `buildUserListQuery()` (skips undefined — old code did `new URLSearchParams(params as any)` which emitted literal `"undefined"` strings). `useSystemUsers`/`useTenantUsers(tenantId, params?)` share it; param name is **`page_size`**, not `limit` (backend ignored `limit` entirely — effective page silently 50).
- `TenantUserTable` converted to controlled/server-driven like `SystemUserTable`: `total/page/limit/onPageChange/onFiltersChange` props, debounced search, Active/Inactive/**All** status. Both consumers (`/console/admin/$tenantId` + `/console/admin/system/tenant/$tenantId`) hold `userPage`/`userFilters` state, reset both on `tenantId` change (same-route param changes don't remount). Members counts now use `data.total`, not `data.users.length` (page size).
- `active` is tri-state end-to-end: filter default `{ active: "all" }` so the select label matches the request; backend maps `absent -> true (default)`, `"all" -> no filter`, else bool, invalid -> 422 (`_parse_active` in `admin.py`, `list_all_users(active: bool | str)`).
- Modal plant pickers: `useTenantPlants(tenantId)` toggleable chips (primary-tinted when selected) in `CreateUserModal` + `UserEditModal`; tenant change resets `plantIds` (plant_ids are tenant-scoped, backend 403s foreign ids); dangling ids render as destructive chips with X. Edit-modal email is read-only with hint (user chose hiding over adding `email` to `UserUpdate`).
- Search debounce: fixed pre-existing bug where the `setTimeout` cleanup was returned from the event handler (never runs) — now `useRef` + `useEffect` cleanup.

**Gotchas:** `exactOptionalPropertyTypes: true` — can't pass `action={cond ? obj : undefined}` to optional props; spread instead (`...(cond ? { action: obj } : {})`). Editing a `useState` block near a hook call risks duplicating the state block — `tsc` catches it as TS2451 redeclare.

**Verified:** backend 152 passed (+`test_active_filter_tri_state`), `tsc` + `vite build` clean, live smoke: default 14 vs `active=all` 15 users, `active=banana` 422, `page_size=1` honored, tenant path 13/14 with 1 inactive, `plant_names` on every item. Docs updated: `notes/FRONTEND_NOTES.md` (tri-state note, `AdminUser` type, error table incl. `Cannot delete your own account`/`plant_ids` 403/invite role 403, changelog row) + `API.md` (list params + `plant_names`).

---

## 2026-10-02: Current-shift visibility + team membership UI (frontend)

**Feature:** (a) plant-wide "what shift is running now" visual, (b) per-team shift state, (c) team↔member assignment UI. Backend (new `GET /plants/{id}/shifts/now`, resolved `members` on team GETs, single-team `$pull`, `team_name` on users) is specified but **owned by the user's backend session — frontend was built against the contract and degrades until it ships**.

**Frontend:**
- `src/lib/hooks.ts`: `NowShift`/`TeamNow`/`ShiftsNowResponse` types + `useShiftsNow` (60s `refetchInterval`, **`retry: false`** so a missing endpoint hides the UI instead of hammering 404s), `TeamDetail`/`TeamMember` + `usePlantTeamsDetail` → `GET /teams?plant_id=` (full docs vs `useTeams`' `/plants/{id}/teams` summaries), `useUserDirectory(tenantId, enabled)` → `GET /users?page_size=200` (supervisor+ desktop only — enable flag avoids 403 noise), `useSetTeamMembers` full-replace mutation invalidating `["dashboard"]` + user-list prefixes (admin `team_name` refreshes).
- `src/lib/shift-now.ts`: shared formatters (`formatClock`, `formatWindow`, `shiftLabel`), `teamNowBadge()` (on/next/off tones), `earliestNextShift()` — consumed by pill, banner, team cards.
- `ConsoleShell` header pill: renders **only when data exists** (loading/error → nothing); green dot + `Night · 22:00–06:00 · 2 on`, or muted "No shift running".
- `CurrentShiftBanner` component on `/console` above stat cards: fetches itself, returns null on load/error (dashboard never blocks on it — it's deliberately NOT part of the page's loading/error aggregation). On-shift teams = success-tinted badges (with line name), off = muted; counts + earliest next shift.
- Teams page: per-card `teamNowBadge`; Members panel from `usePlantTeamsDetail` — resolved `members` list with remove, `Add member` search/combobox from directory (filtered to active non-members), fallback "N members" when backend hasn't shipped `members` enrichment, full-replace save via `saveMembers`, inline error state, `hasMinRole(user.role, "supervisor")` gates all controls (mirrors backend `require_desktop("supervisor")`).
- Admin read-only: `team_name?: string | null` added to **both** `SystemUser` interfaces; Team column in both tables (`colSpan` bumped 5→6 / 6→7); `UserEditModal` read-only Team row pointing to the Teams page.

**Gotchas:** mobile `GET /plants/{id}/shifts/current` is caller-team-scoped AND mutates the DB (inserts pending/scheduled shifts) — the new `/shifts/now` contract explicitly forbids both; `GET /users` (directory for the picker) is `require_desktop("supervisor")`, so the query must be enable-gated by role or operators get 403 spam; `User` in shift-log has `tenant_id` (needed as directory query key — avoids cross-tenant cache hits).

**Status:** `tsc` + `vite build` clean. Live smoke of the new UI **blocked until backend ships the 3 changes** — pill/banner/members silently degrade until then.

---

## 2026-10-02: Schedule page (clickable shift pattern) + shared TeamMembersDialog

**Feature:** (a) new `/console/schedule` — 7-day week grid, teams (rows) × days (cols), colored shift blocks, **every cell clickable** → shift detail dialog showing shift type/window/status **plus the team's member roster**, (b) member management extracted into a shared supervisor dialog used from Teams + Schedule.

**Frontend:**
- `src/lib/shift-now.ts`: added `SHIFT_COLORS` (moved out of `calendar.tsx` — single source now), `shiftCellStyle(type)` → `{dot, cell, text}` classes (morning=yellow, afternoon=orange, night=indigo, day=sky, off/unknown=muted).
- `src/lib/hooks.ts`: `PatternDay`/`PatternTeam`/`ShiftsPatternResponse` + `useShiftsPattern(plantId, from, days)` → `GET /plants/{id}/shifts/pattern?from=&days=7`, `retry: false` (endpoint doesn't exist yet → page shows its empty state, not a spinner loop).
- `src/routes/console/schedule.tsx` (new route): week nav (‹ › Today), legend, `grid-cols-[160px_repeat(7,minmax(0,1fr))]` inside `overflow-x-auto` (min-w 820px), today column ringed, cells disabled "—" when no data. Click → detail Dialog (radix, conditional children — never render an empty `DialogContent`) with roster from `usePlantTeamsDetail` + `Manage/View members` button → `TeamMembersDialog`. Degrade branch renders team chips that open the members dialog directly so the page is useful pre-backend.
- `src/components/console/TeamMembersDialog.tsx` (new, shared): roster (any role, read-only) + add/remove edit mode gated by `hasMinRole(role,"supervisor")`; looks up the *freshest* team doc via `usePlantTeamsDetail` (mutation invalidates it), directory query enabled only while `open && canManage`; state reset in `useEffect` keyed on `open`/`team.id`.
- Teams page: inline panel replaced by roster preview (first 4 + count fallback) + Manage/View button; all directory/mutation state moved into the dialog. Nav: `Schedule` entry (CalendarRange icon) after Calendar in `ConsoleShell.NAV`.

**Gotchas:** `noUncheckedIndexedAccess` + `noPropertyAccessFromIndexSignature` — `SHIFT_COLORS.morning` (dot access on index signature) fails TS4111/TS2322; use string literals inside the record instead of referencing another index-signature record. `routeTree.gen.ts` regenerates during `vite build` — new file-based routes need no manual step. Smoke-test note: backend (`:8000`) hung mid-session (port listening, `/health`+`/docs` time out) — frontend checks (`tsc`, `vite build`, route 200s on `:8080`) still valid; confirmed `GET /plants/{id}/shifts/pattern` → 404 before the hang (degrade path correct).

---

## 2026-10-03: /shifts/now shape mismatch crashed every console page

**Bug:** logging in as supervisor → clicking Console → "This page didn't load". `TypeError: Cannot read properties of undefined (reading 'filter')` at `ConsoleShell.tsx:60` (5 re-render crashes).

**Root cause:** the backend session implemented `GET /plants/{id}/shifts/now` with its own shape — `{"current_shift": {shift_type, start_hour, end_hour, start, end, date, team:{id,name,supervisor|null,member_count}|null, source} | null}` (single rotation-resolved team) — while the frontend type still claimed `{now, plant_shift_type, plant_shift_window, teams[]}`. `now?.teams.filter(...)` short-circuits only when `now` itself is nullish; a truthy `{current_shift: null}` **still crashes** because `.teams` is undefined. Same latent crash in `CurrentShiftBanner` (`data.teams.filter`, `earliestNextShift(data.teams)`).

**Fix (frontend adapted to the implemented backend — no backend changes):**
- `hooks.ts`: `NowTeam`/`CurrentShift`/`ShiftsNowResponse {current_shift: CurrentShift | null}` replace `NowShift`/`TeamNow`; deleted `teamNowBadge` + `earliestNextShift` from `shift-now.ts` (backend exposes no next-shift data).
- `ConsoleShell` pill: `shift = data?.current_shift ?? null` → green pill `Type · window · team name`; gray "No shift running" only when `!isLoading && !isError` (no flash/error lie); `.filter` line deleted.
- `CurrentShiftBanner` rework: `useTeams` strip where **on-shift is derived** — `current_shift.team` first (green, with supervisor + member_count), all other teams muted "Off"; counts derived (`onCount = team ? 1 : 0`); "via rotation|pattern" source note.
- `teams.tsx` card badges derived: `currentShift.team?.id === team.id` → `On shift · …`, else `Off now`, none when `current_shift` is null; dropped the "next" tone.

**Verified live:** backend returns `{"current_shift": null}` for `sup-1@optilog.com` (TestPass123!, plant `6abd9cd7…`, but that plant currently has **no teams and no shift_patterns** — data state, not code); `tsc` + `vite build` green; `/console`, `/console/teams`, `/console/schedule`, `/console/calendar` → 200; `GET /users` directory works for supervisor desktop tokens (dialog picker will populate).

**Lesson:** a TS response type is a *claim*, not a check — when a backend endpoint lands from another session, curl it and diff against the interface before trusting the type. Also: optional chaining `a?.b.filter()` protects `a`, never `a.b`; guard the property you actually call methods on (`a?.b?.filter()`), or normalize at the fetch boundary.


---

## 2026-10-03: Shift generator engine — Schedule template preview + config/cell edit flow

**Feature:** (a) the onboarding rotating-preview visual (M/A/N/D/- letter grid) now renders **inside the Schedule page** as a "Schedule template" strip driven by live pattern data, phase-accurate per crew row — and still renders (default pattern) when a plant has **zero teams/patterns**; (b) post-onboarding editing: shift-window CRUD + rotation cycle/phase PATCH via a new "Edit schedule" dialog, plus per-day cell overrides; (c) onboarding wizard may now submit an **empty roster** (backend auto-creates crews from `globalShiftConfig`); (d) start-shift screen confirms shift/team/area (your-team badge + mismatch warning + area-grouped line picker).

**Backend spec (NOT yet implemented — delivered as `optilog-backend/notes/SHIFT_GENERATOR_SPEC.md`, A1–A7):** team-less `PlantSetup` (+`globalShiftConfig`, tenant check, idempotent re-setup), synthetic `kind:"track"` crew rows in `GET /shifts/pattern` with `override_id` per cell, `shift_overrides` collection + `/shifts/overrides` CRUD (override wins over computed cell AND materialized doc), `GET/PATCH /plants/{id}/rotation-config` (409 when switching from `extended`), worker `effective_day_offset` fix, tests for all of it.

**Frontend:**
- `src/components/ShiftCycleStrip.tsx` (new, shared): `CyclePreview` (static mode — config-driven; rotating/extended/regular; pixel-identical to the old onboarding `RotatingPreview`, which was deleted from `PlantSetupForm`) + `ShiftCycleStrip` (data mode — `rows × colDates` letter grid with legend derived from cell `start`/`end`) + `formatHour`/`shiftTypeLetter` exports. `PlantSetupForm` now imports these; previews were also ADDED to the extended and regular-day panels (previously rotating-only).
- `schedule.tsx`: strip card above the grid (`mb-4`), rows mapped from `pattern.data.teams`; **zero-row success** and **error** states both fall back to a static default `CyclePreview` so the visual is always present; `kind:"track"` rows show a "Crew template" sub-label and their detail dialog swaps the member roster for an assign-operators note; cells with `override_id` show a `*`; selection is re-resolved against fresh pattern data (`sel` lookup) so overrides update live after invalidation.
- `ScheduleConfigDialog.tsx` (new): pattern list with immediate-apply edits (type select, hour inputs, M–S day toggles guarded against emptying the set, active toggle, two-click delete), add-pattern form surfacing 409 overlap messages, rotation section (2-2-2-2/3-3-3-3 buttons + phase stepper; hidden when rotation 404; read-only note for `extended`).
- `hooks.ts`: `ShiftPattern`/`RotationConfig`/`ShiftOverride` types + `useShiftPatterns` (handles bare-array OR `{items}` response), `useRotationConfig`, `useShiftPatternMutations`, `useUpdateRotationConfig`, `useShiftOverrideMutations`; all invalidate a shared schedule set (`shifts-pattern`, `shift-patterns`, `rotation-config`, `shifts-now`, `current-shift`). `PatternTeam.kind?` + `PatternDay.override_id?` added as OPTIONAL (old backend still typechecks).
- Wizard: `canNext` step 3 allows `teams.length === 0` (custom still requires ≥1); setup payload gains `globalShiftConfig: teams[0]?.shift_config ?? defaultShiftConfig(globalShiftType)`; `useApplyWizardConfig` type updated + invalidates `["dashboard"]`.
- Start-shift (`routes/index.tsx`): `usePlantTeamsDetail` resolves the operator's own team → "Your team" chip when the shift matches, warning box when it differs; line `<select>` grouped into `<optgroup>` per area via `useAreas`+`useLines` (flat fallback); `ShiftState` gains optional `teamId`/`teamName` set in `handleStart`.

**Gotchas:** rotating shift-hours decision — keep the codebase defaults 6-14/14-22/22-6 (user confirmed; do NOT "fix" to 7-15/15-23/23-7). `CyclePreview` prop typing deliberately duplicates the `ShiftConfig` union locally instead of importing it — avoids a circular import with `PlantSetupForm` (structural typing makes the real config assignable). Backend `update_shift_pattern` filters `None` values, so `active: false` PATCHes work but you can never set a field back to null. `require_desktop("supervisor")` on `/shift-patterns` writes is satisfied by console sessions (login sends `client_type:"desktop"`), same as `/users` directory.

**Status:** `tsc` + `vite build` green; live smoke: dev `:8080` schedule → 200, `sup-1` login OK, `GET /shifts/pattern` → `teams: 0` rows (backend spec not yet applied) → page correctly renders the "No schedule generated yet" state + default preview. Full end-to-end (tracks strip, overrides, rotation PATCH, edit dialog writes) **blocked until the backend session applies SHIFT_GENERATOR_SPEC.md A1–A7**.

**Lesson:** design the degrade path as a feature, not a fallback — every new server-driven visual (strip, kind rows, overrides) was shipped with an optional type field and a static default so the page is useful before the backend lands; the same pattern (spec-first to the backend session, frontend contracts typed optional) that saved the `/shifts/now` crash.


---

## 2026-10-03: Extended onboarding 422 fix - wizard shift_config mapped at the payload boundary

**Bug:** `POST /admin/plants/{id}/setup` with the Extended Day + Night wizard mode returned `422 union_tag_invalid` on every `teams[i].shift_config`: the wizard's internal `ShiftConfig` union has a `type: "extended_rotating"` member (`hours.day`/`hours.night`), but the backend `TeamSetup.shift_config` discriminated union only accepts `regular_day | extended_day | night | rotating` (`app/schemas/shifts.py`). **Pre-existing** - extended mode was never end-to-end tested; not caused by the shift-generator frontend work. Also confirmed the backend session had NOT applied `SHIFT_GENERATOR_SPEC.md` yet (no `global_shift_config`/`shift_overrides`/`rotation-config` anywhere in `app/`), so the new `globalShiftConfig` field was being ignored as an extra - it would have become a second 422 once A1 landed.

**Fix (user chose frontend mapping over backend union extension):**
- `src/lib/admin-hooks.ts`: new `toBackendSetupPayload()` inside `useApplyWizardConfig.mutationFn` (the single `/setup` submit path -> verified by grep) maps every team config `type === "extended_rotating"` -> `{type:"night", start_hour, end_hour}` when `current_shift === "night"`, else `{type:"extended_day", ...}` with the team's own day/night hours. `regular_day`/`rotating` pass through (already structurally identical to backend types); `globalShiftConfig` passes through unmapped. Backend stores canonical `extended_day`/`night` docs the existing setup pattern branch and dashboard `_config_type` already understand - zero backend change needed for the user's blocked onboarding.
- Spec delta (`optilog-backend/notes/SHIFT_GENERATOR_SPEC.md` A1): `global_shift_config` gets a NEW union (`GlobalShiftConfig`) with an `ExtendedRotatingConfig` member (`type + hours.day/hours.night`) - must NOT reuse the strict per-team `ShiftConfig`; roster synthesis takes day/night hours from it (defaults 7-19/19-7); contract note that per-team configs arrive canonical; `global_shift_type: "custom"` stays rejected (deferred, user confirmed leave-as-is).

**Gotchas:** pydantic v2 ignores unknown body fields by default - that's why `globalShiftConfig` didn't error pre-A1 (absence of its 422 in the user's response was the tell that A1 wasn't applied). Custom mode would 422 on `global_shift_type` regex (`custom` not in pattern) - separate pre-existing gap, explicitly deferred. Smoke tests hit the API directly with the mapper's OUTPUT shape (PowerShell has no access to frontend TS code) - the mapper logic itself is covered by `tsc`.

**Status:** `tsc` + `vite build` green. Live smoke (tenant-admin login, throwaway plants, all deleted): unmapped extended payload -> **422** (baseline reproduced); mapped payload -> **200** `{areas:1, lines:1, teams:3}`; `GET /shifts/pattern` -> 3 rows with correct stored configs (Team A `extended_day` 07:00-19:00, Team B `night` 19:00-07:00, Team C off); regular -> 200; rotating -> 200. User can now retry the real onboarding on plant `6ac0b224aa2b8c52dd2e1838`.

**Lesson:** when a request 422s on a discriminated union, diff the sender's type against the receiver's union FIRST - and check which side is the "UI model" vs the "storage model". Translating at the single payload boundary (one choke-point hook) beats widening the backend union when the target type already has readers that only understand canonical members; for NEW fields (like `globalShiftConfig`) you're free to shape the union yourself - amend the spec before the backend session implements it.

---

## 2026-10-03: Onboarding preview rework - per-team 14-day rows

**Change:** `CyclePreview` (`ShiftCycleStrip.tsx`) now renders one row per team across a 14-day grid (52px label column + 14 letter cells, header Mon..Sun twice). Each row is phase-shifted from its `current_shift`: rotating -> offset of `block` days (morning/afternoon/night/off -> 0/b/2b/3b), extended -> 0/1/2 (day/night/off); a new optional `teams` prop carries name + `current_shift` + per-team `shift_config` (row falls back to the panel config). All six PlantSetupForm call sites now pass `teams={teams}` - global-hours panels show the full roster, custom cards show every team with its own config; without `teams` (Schedule page fallbacks) it defaults to the wizard's roster (Team A-D / A-C / Team A). Regular preview also became 14-day for consistency. Column check: day 0 across rotating rows = M/A/N/- (2-2-2-2), one shift per crew. Also fixed `replaceConfig` rebuilding the team object and silently wiping `assigned_line_indices` on any shift-config edit (now `{...team, shift_config}`).

**Lesson:** the old static preview showed a SINGLE crew phase wrapped over a Mon-Sun x2 grid - it could not express "each team's shift", which is exactly what the data-driven Schedule strip (rows x dates) shows. Keep static and data-driven versions of the same visual structurally identical (row per crew, label column, phase offsets) or onboarding will promise something the schedule page does not deliver. PS: `Add-Content` on this box writes ANSI - append learnings as pure ASCII (use `->` and `-`, not arrows/em-dashes), or byte-surgery a UTF-8 section afterwards.

---

## 2026-10-03: Supervisor "disappeared" - system_admin user PATCH corrupted tenant_id and wiped plant_ids

**Symptom (user report):** assigned a supervisor to a new plant, he vanished, login says "user not found".

**Root cause (audit field is `timestamp`, NOT `created_at`):** two `user.update` events at 09:33:43/09:34:36 (system_admin editing sup-1 then sup-2 in UserEditModal), fields `['name','plant_ids','active','tenant_id','updated_at']`. Backend `update_user_admin` (`app/domain/admin/service.py:878+`) had two flaws on the system_admin branch:
1. line ~917: `updates["plant_ids"] = []` runs whenever `tenant_id` is present in the payload - the "same tenant, nothing to change" `pop` only exists in the NON-system_admin branch. UserEditModal.tsx:75 always sent `tenant_id` for system_admin, so every save silently wiped the plant assignments made in the same payload.
2. `updates["tenant_id"]` was written straight from JSON as a STRING (plant_ids get `_to_oid` at line 929; tenant_id never did). `list_all_users` queries `tenant_id: _to_oid(...)` (line 689), so the corrupted users fell out of `GET /admin/users` entirely -> supervisor vanished from the Users page. Login was never broken (email lookup ignores tenant_id type) - the user's login failure is a separate mystery (asked which email they typed).

**Repair (data):** Mongo `$set tenant_id: ObjectId(...)` for sup-1/sup-2 (the API cannot fix it - system_admin PATCH always re-sends a JSON string); plant_ids restored via PATCH as tenant-admin (non-system_admin branch pops tenant_id, bypassing both bugs). Verified: list returns 14/14 with `plants: [Factory Alpha]`, sup-1 login 200 with TestPass123!.

**Fix (frontend, shipped):** UserEditModal sends `tenant_id` ONLY when `tenantId !== (user.tenant_id ?? "")` - bypasses both backend bugs for the common case; `tsc` + build green.

**Fix (backend, DELIVERED AS PATCH for the user's backend session - do not edit their working copy):** in `update_user_admin` after tenant validation: `updates["tenant_id"] = _to_oid(new_tenant_id)` and guard the wipe with `if str(new_tenant_id) != str(user.get("tenant_id")): updates["plant_ids"] = []`. `create_user_admin` is already safe (`_to_oid` at line 855).

**Gotchas:** audit `detail.fields` = payload keys (updates dict), NOT actual diffs; `list_plants` filters `active: True` (8 legacy/abandoned plants are soft-inactive, so only Factory Alpha appears in plant pickers - `scripts/cleanup_deleted_plants.py` hard-cleans those); teams have no `updated_at` on create (a "teams updated" query looks empty because the field is never set); login `client_type` only accepts `mobile`/`desktop` (frontend omits it - do not send `"web"`).

---

## 2026-10-04: Sign out goes straight to login - no cleared-dashboard frame

**Bug:** console Sign out (`ConsoleShell.tsx`) did `logout()` (clearToken + `setState({user:null...})`) then `window.location.href = "/"`. The setState flushed a re-render of the console with `user: null` BEFORE the browser unloaded it, so the dashboard visibly emptied first; the login screen (`LoginScreen` is inline at `/` via `routes/index.tsx:90` - there is no dedicated /login route) only appeared after the reload.

**Fix:**
- `shift-log.ts` gains `logoutHard()`: `clearToken()` + `localStorage.removeItem(STORAGE_KEY)` + `location.replace("/")` - clears token and the PERSISTED store directly, WITHOUT `setState`/`emit`, so nothing re-renders before navigation. `replace` keeps the console out of history (Back skips it). Full reload also discards the React Query cache. Mobile `AppShell` keeps plain `logout()` (same-route in-place swap, no intermediate frame).
- Why not just skip the state clear: the store persists the whole state to `shiftlog.state.v1` on every setState, and `restoreSession()` with no token only sets `loading: false` (it NEVER nulls a hydrated `user`, shift-log.ts:281-283) - navigating without clearing the persisted state would boot into a stale "logged-in" shift screen instead of the login page.

**Gotcha (found by curl):** a token check in a route `beforeLoad` runs SERVER-side on fresh loads, where `getToken()` is always null (no window/localStorage) -> `/console` 307'd to `/` for EVERYONE, including logged-in refreshes. Guard must be window-gated (`typeof window !== "undefined" && !getToken()`), with fresh loads covered by a client-side component gate instead: `routes/console/route.tsx` `ConsoleGate` checks `useShiftLog().user` in an effect (Root only renders the Outlet after restoreSession, so `user` is authoritative) and `navigate({to:"/", replace:true})` - same pattern as `console/admin/route.tsx`.

**Status:** `tsc` + build green; `curl /console` 200 (was 307 pre-fix), `curl /` 200.

---

## 2026-10-04: Layout tab — drag-and-drop team/line board (`/console/layout`)

**What shipped:** new console nav entry **Layout** (`ConsoleShell.tsx` NAV, icon `LayoutGrid`) → `routes/console/layout.tsx` → `components/console/LayoutBoard.tsx`. Unplaced tray (+ "New team" via `POST /teams`), area sections with read-only line columns (droppable), team cards (draggable + sortable, per-line instances), member chips (sortable within a team, draggable between teams/pool), unassigned-people pool (supervisor+ only). Coverage actions on each card: "All lines", "Lines..." popover (checkboxes), "Remove placement". Permissions: view all roles (DndContext `sensors={[]}` + `disabled` on every sortable/draggable), edit = `hasMinRole(role, "supervisor")` (backend already gates `POST/PATCH /teams*` with `require_desktop("supervisor")`). Deps added: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (React 19 compatible; react-beautiful-dnd is abandoned).

**Data model:** `team.assigned_line_ids: string[]` (absent/[] = unplaced tray, non-empty = card renders on each line — many-to-many) + `team.sort_order: int` (order within a column). Both optional on `TeamDetail` so an un-patched backend degrades to "all teams unplaced" (the designed default anyway). Drag line1→line2 = move (remove source instance's line, add target); multi-line precision via the checkbox popover; "All lines" = PATCH every line id. Member moves use `POST /teams/{id}/members` full-replace — backend already pulls the member from their old team (one-team-per-user). `useUpdateTeam`/`useSetTeamMembers` do optimistic `teams-detail` patches with snapshot rollback (`onMutate`/`onError`), invalidating `["dashboard"]` on settle.

**dnd-kit gotchas:**
- A team placed on N lines renders N card instances — dnd-kit ids MUST be unique, so ids are instance-scoped: `t:{lineId|tray}:{teamId}` and `m:{lineId|tray|pool}:{userId}`. Drop handling branches on `over.data.current.kind` (member/team/line/pool/tray) instead of parsing ids; `active.data.current.instance` carries the source line for move semantics.
- Read-only mode = pass `sensors={[]}` to DndContext (sensors prop replaces defaults) AND `disabled: true` on each `useSortable`/`useDraggable`.
- PointerSensor `activationConstraint: {distance: 8}` lets clicks reach the chip "x" and card buttons; the "x" also stops `pointerdown` propagation so it never starts a drag.

**Line/area API gotchas:** `GET /plants/{id}/lines` (`list_plant_lines`, dashboard service) returns ONLY `{id, name}` — `area_id` stripped — so `useLines` data cannot be grouped by area (pre-existing breakage on `data.tsx:85` and `index.tsx:194`; backend fix = LAYOUT_SPEC A8). The area-nested route lives under the **`/assets/` prefix**: `GET /assets/areas/{areaId}/lines` returns full docs incl. `area_id` (a bare `/areas/.../lines` 404s — check `openapi.json` paths, frontend hook paths and actual routes differ). New `usePlantLinesByArea(plantId)` composite query fetches areas + per-area lines in parallel and returns `{area, lines}[]` groups; LayoutBoard dropped `useAreas`/`useLines` and the orphan-line logic (no area-delete endpoint exists, so orphans can't occur).

**Environment/data notes:** the demo DB was reset before this task (10 of 15 users deactivated incl. sup-1/sup-2, 0 plants). Created sandbox plant **"Layout Sandbox"** `6ac19dd8f547e57f92febbb6` (2 areas/3 lines/3 teams via `POST /admin/plants/{id}/setup`) and assigned it to tenant-admin's `plant_ids` (plant_manager >= supervisor, so it exercises every board mutation) for browser testing. **No `DELETE /teams` endpoint exists** — the smoke-created team was hidden with `PATCH {active:false}` instead. `LAYOUT_SPEC.md` A1–A5 were applied by the user's backend session while this frontend work was in progress (uvicorn --reload) and verified live: setup `assigned_line_indices: [0,2]` → `assigned_line_ids: [L1, L3]`; PATCH persists + rejects foreign/junk line ids.

**PowerShell 5.1 + curl.exe:** JSON bodies passed as `-d '{...}'` or via here-string variables arrive mangled (`{"detail":"json_invalid","input":{}}`) — write the payload with `Set-Content` to `$env:TEMP\*.json` and use `--data-binary "@$file"`. `$pid` is a read-only automatic variable (assignment throws with `$ErrorActionPreference='Stop'`) — use `$plantId`.

---

## 2026-10-04: Onboarding wizard claimed success while creating nothing (setupApplied bypass)

**Bug:** a full wizard run in "Use My Setup" mode produced a plant with 0 areas / 0 lines / 0 teams (Teams tab empty, Schedule showed the default day pattern, Layout tray empty). Server reads proved `POST /admin/plants/{id}/setup` never ran (areas `[]`, teams `[]`, pattern `{teams: []}`) while plant creation, tenant, and pm-2's plant_ids assignment were all correct - frontend-only.

**Root cause:** `OnboardingWizard.tsx` persists `{step, data, plantId}` including `data.setupApplied` to localStorage (`optilog.onboarding.v1`, 24h TTL). Step-4 Next did `if (data.setupApplied) { setStep(5); return; }` - a stale flag from an earlier session jumped straight to the Review screen (instant "success", green banner "Your wizard configuration has been applied") with NO POST. Secondary hazards: all three catch blocks were `catch {}` with comment "Error handled by mutation" (nobody handled it); the Skip card promised "set up areas, lines, and teams later from the plant dashboard" (that UI does not exist - no frontend caller of `POST /assets/plants/{id}/areas` or `/areas/{id}/lines`, Teams tab has no create either); Review claims were gated on `setupMode` alone.

**Fix (OnboardingWizard.tsx + api.ts):**
- `checkPlantSetup(plantId)`: GET `/assets/plants/{id}/areas` + `/plants/{id}/teams` in parallel -> "applied" (both non-empty: advance + `setupConfirmed`) / "empty" (clear the flag and fall through to a real POST) / "partial" (error, refuse - re-running duplicates rows). The persisted flag is now a hint, never authority.
- `stepError` state (cleared on step change) replaces the mutation-isError banner; every catch sets it via `errorMessage()` (ApiError.message). Stale `plantId` (PATCH 404) -> inline "Create new plant instead" button (`setPlantId(null)`).
- Review banner + Teams summary gated on `setupConfirmed` (set only by a real response or a passing verification); Skip card + review copy no longer point at the nonexistent dashboard flow and warn how many areas/lines/teams Skip discards.
- api.ts: FastAPI 422 `detail` is an ARRAY of `{loc, msg}` - the old code cast `detail` to string (undefined) and fell back to "Request failed (422)"; both error blocks now extract `detail[0].msg` (identical blocks -> `replaceAll`).

**Diagnosis trail:** wrong-plant/tenant hypothesis killed by admin reads (pm-2 plant_ids = only the new plant, same tenant); the `setupApplied` bypass was the only code path to Review without a POST (a real 2xx would have created rows). `setup_plant` writes no audit record - backend spec note if observability is wanted later.

**Status:** tsc + build green. User will delete the empty plant and redo onboarding.

---

## 2026-10-04: Console empty-states + ONBOARDING_TENANT_SPEC.md (two-phase fix, phase 1 = spec only)

**Root cause (proved live, backend):** `setup_plant` (admin/service.py:415) does `tenant_id = user["tenant_id"]` -> `None` for system_admin `admin@optilog.com` -> `_to_oid(None)` **generates a fresh random ObjectId per call** (`ObjectId(None)` is a valid new id). Plant doc kept the correct tenant (from the URL), but every child (areas/lines/teams/shift_patterns) got a random tenant -> all tenant-filtered console reads return `[]` for EVERY user. Data exists; it is invisible. `seed_service.py:158-162` already does it right (derive tenant from plant + access check) - that is the model for A1.

**Read-side half:** list endpoints filter by the CALLER's tenant, so system_admin (`tenant_id: null`) gets `[]` everywhere (proved: sandbox areas `[]` as admin@). This also makes the wizard's verify-before-reapply (`checkPlantSetup`) see "empty" under system_admin and re-POST duplicates - the frontend hardening is only tenant-correct AFTER spec A2.

**Delete cascade:** `delete_plant` (service.py:310-326) sets `active: false, plant_ids: []` on members whose only plant was deleted -> every delete+re-onboard cycle silently bricks test accounts (pm-2 ended deactivated). `member_summary` (388) exposes a `deactivated` counter; grep confirms ZERO frontend consumers (`useDeletePlant` admin-hooks.ts:140 ignores the response body) -> safe to drop in A4.

**Shipped (frontend, gates green: tsc + vite build):**
- `notes/ONBOARDING_TENANT_SPEC.md` in the BACKEND repo: A1 setup_plant plant-derived tenant, A2 plant-scoped reads derive tenant from parent doc (assets/dashboard/patterns/lines list fns), A3 4 regression tests, A4 drop member deactivation on delete. Sequencing warning inside: apply BEFORE re-onboarding Fact Alpha or the data re-corrupts.
- New `components/console/EmptyPlantState.tsx` (dashed card, title+description).
- `ConsoleGate` (console/route.tsx): `plant_ids: []` and NOT on `/console/admin/*` -> "No plant assigned" card (+ admin console link only for `hasMinRole(..., "plant_manager") && user.tenant_id`); admin paths pass through so onboarding/user management stay reachable plantless.
- Teams page: `teams.data` empty (after loading/error branches) -> EmptyPlantState inside ConsoleShell.
- LayoutBoard: `lines.length === 0` inline div upgraded to EmptyPlantState (tray above still renders, so existing teams stay visible).
- Schedule: new branch `pattern ok && teams.data empty` -> EmptyPlantState; loading branch now also waits on `teams.isLoading` (otherwise flash of "No schedule generated yet"). Pre-existing `stripRows === 0` state kept (it shows the default CyclePreview - good).

**Decisions honored:** no wizard auto-assign of users to plants (user assigns later); repair = user deletes + re-onboards AFTER applying the spec (I did not write to Mongo); tenant fix + delete fix folded into ONE spec file; spec delivered as `notes/` markdown (user applies in their pytest session).
- Follow-up: ConsoleGate intercepts BEFORE ConsoleShell mounts, so the "No plant assigned" card renders with no sidebar - the System Admin nav item (`ConsoleShell.tsx:40`) was unreachable for admin@ (tenant_id null hid the admin link). Card now carries a role-based launcher: system_admin && !tenant_id -> "Open the System Admin console" -> `/console/admin/system` (route guard admits system_admin only, `admin/system.tsx:15`); plant_manager+ && tenant_id -> existing `/console/admin/{tenant_id}` link. Note admin@ IS a console user (login pre-fills it, `/console` gate is auth-only) - it just must not see plant data.
- Follow-up 2: `ConsoleShell` rendered all 11 plant NAV tabs + plant header pills unconditionally, so system_admin (no plant) saw dead tabs and a misleading "Data layer live"/"-" plant pill. Now: `plantTabsVisible = hasPlant || (isAdmin && showPlantTabs)` gates both NAV maps (desktop :91, mobile :191); header shift/plant/data-live pills gated on `hasPlant` (sign-out always); a "Show/Hide plant tabs" toggle (visible only to plantless system_admin) persists to `localStorage["optilog.console.showPlantTabs"]`. Revealed tabs still land on the ConsoleGate card by design. Reversed per user choice: hidden by plant for everyone, re-reveal toggle is system_admin-only. Plant users see zero difference.

---

## 2026-10-04: Unified shift codes M/A/N/D/- (schedule grid + calendar) + defaults clarified

**Vocabulary (user decision):** rotating 2-2-2-2 / 3-3-3-3 = morning/afternoon/night shown as **M/A/N** with off as **"-"** (not O); extended = **D/N**; regular = **D**. Canonical helpers `shiftTypeLetter`, `LETTER_STYLES/DOTS/LABELS`, `type Letter` MOVED from `components/ShiftCycleStrip.tsx` to `src/lib/shift-now.ts` (single source; strip imports them now). No behavior change to the strip/onboarding previews - they already used letters.

**Changed surfaces (scope = grids + legends + calendar; banners/chips/dialog titles keep full words):**
- `schedule.tsx`: weekly grid cell label `shiftLabel(...)` -> `shiftTypeLetter(...)` (M/A/N/D, off `-`, no-day stays "�"); hours line + override `*` unchanged; cell dialog still full word. NEW legend under the grid: letters seen in the visible week, first-seen hours per letter, dot colors from `shiftCellStyle(type).dot` (matches the grid palette, NOT the blue onboarding palette - the two palettes intentionally coexist).
- `calendar.tsx`: legend entries now "M Morning / A Afternoon / N Night / D Day" (added the missing D entry for regular-day plants); month popover title = "M � Morning shift".
- Off = "-" everywhere (user chose it to match existing strip).

**Team-count defaults (user confirmed - NO code change):** wizard `PlantSetupForm.generateTeams()` already gives rotating_2222/3333 = **Team A-D** (morning/afternoon/night/off), extended_rotating = A-C, regular_day = A; matches backend `SHIFT_GENERATOR_SPEC.md` A1 roster table. The "only 3 teams" the user saw was MY test fixture `Layout Sandbox` (A/B/C + smoke team, all regular_day) - user will re-onboard it themselves (chose that over me driving API writes). Fact Alpha already deleted by user.

**Backend constraints found (for future fixture work):** `POST/PATCH /teams` do NOT accept `current_shift` (only setup writes it + rotation team_order), and `setup_plant` APPENDS teams (no cleanup until spec A1) - so you cannot fix a roster in place; a fresh plant/setup is the only clean path.


---

## 2026-10-04: Bulk user actions (system + tenant admin tables) + Toaster mounted

**Backend contract (wired by the backend session, verified in working tree):** `POST /admin/users/bulk-update` `{user_ids<=200, patch, plant_mode: replace|add|remove}` -> `{updated, failed:[{id,error}]}`; `POST /admin/users/bulk-delete` `{user_ids}` -> soft deactivate (`active=false`, parity with single `DELETE /admin/users/{id}`/"Deactivate"; self never allowed); `POST /admin/invitations/bulk-revoke` `{invitation_ids}` -> `{revoked, failed}`. Tenant-surface `POST /users/bulk-update` exists but has NO frontend consumer (both admin tables read `/admin/tenants/...` and `/admin/users`).

**Backend rules that shaped the UI:** cross-tenant `plant_ids` = request-level 403, so the system (cross-tenant) table enables the plant dialog ONLY when every selected user shares one `tenant_id`; per-user failures are normal (rank/tenant/self) -> partial-failure dialog listing `name (email) - error`; bulk-update with `active:false` runs as action "deactivate" (system_admin may self-deactivate), bulk-delete never may.

**Shipped (gates green: tsc + vite build client/SSR/nitro):**
- New `components/admin/UserBulkActions.tsx`: `useUserSelection` (Set; cleared on page/filter change - `page_size` max 100 < 200 cap, so no request chunking), action bar (Activate / Deactivate / Assign plants... / Remove plants... / Change role... / Clear) + AlertDialog confirm with name preview, plant chip dialog (add/remove mode), role dialog (`hasMinRole`-filtered options, system_admin never grantable), failure dialog; sonner toasts for results.
- `SystemUserTable` / `TenantUserTable`: checkbox column (header = select-all-on-page with indeterminate state), colSpan 7->8 / 6->7, bar rendered between filters and table; `emitFilters` clears selection.
- New `components/admin/PendingInvitations.tsx` extracted from the two near-identical invitation blocks (`console/admin/$tenantId` + `console/admin/system/tenant/$tenantId`): select-all + per-row checkboxes + "Revoke selected" + single-row trash with toast on error; pages keep their own empty states via the `empty` prop and dropped now-unused `useRevokeInvitation` / `date-fns format` / `ClientOnly` imports (only the old block used them).
- `<Toaster position="top-right" richColors />` mounted for the FIRST time in `src/routes/__root.tsx` (inside QueryClientProvider) - sonner was installed and vendored (`ui/sonner.tsx`) but never mounted, so `toast()` would have been a no-op before.
- `admin-hooks.ts`: `useBulkUpdateUsers` / `useBulkDeleteUsers` invalidate `["system","users"]` + `["admin","tenants"]`; `useBulkRevokeInvitations(tenantId)` invalidates the invitations key.

**Manual matrix pending (backend on):** deactivate 2 users, activate, plant add/remove, role change, select self+other for partial failure, bulk revoke 2 invitations, selection clears on page change.

- Follow-up (user rejected the first visual): bulk bar restyled to the DESIGN.md console world - flat `border-border bg-card` plate (was `border-primary/30 bg-primary/5` amber wash, violating the Amber Rarity Rule), count as uppercase 12/700 micro-label with `tabular-nums`, all five buttons KEPT (user choice over a "More actions" menu) but grouped by 1px `h-5 w-px bg-border` dividers (status / assignment / role), Activate = `variant="secondary"`, Deactivate + Revoke = ghost `text-destructive hover:bg-destructive/10` (Fault Red = destructive only), `...` suffixes dropped, Clear = ghost icon-only X with aria-label, pending spinner moved to the count label. Same treatment in `PendingInvitations.tsx`. Gates + `impeccable detect` clean.

- Follow-up 2 (user request: confirmation + no-op prechecks): every bulk action now has a precheck + a confirm dialog. Prechecks computed client-side from `SystemUser` fields: `activatable`/`deactivatable` subsets (buttons disabled when 0 with a `title` reason on a wrapper span - disabled buttons show no native tooltip in Chrome; partial selections show `Activate (3/5)` via `countSuffix` and SEND ONLY the changing ids so `res.updated` toasts stay truthful); `plantCandidates` hides no-op plants (add: skip plants already on all selected; remove: only plants assigned to >=1) with an "N of M affected" line, while the plant request still sends ALL selected ids because `$addToSet`/`$pull` are idempotent and one request cannot express per-user plant sets (toast uses the client-computed affected count instead of `res.updated`); `roleChanges` shows a live "N of M will change" line and disables Apply at 0, sending only differing ids. Confirmation = ONE shared `ConfirmSpec` AlertDialog (title/description/confirmLabel/destructive/onConfirm) replacing the deactivate-only state - opened directly by Activate/Deactivate, and opened ON TOP of the still-open plant/role form dialogs on Apply (Radix portals stack; Cancel returns to the form with state intact, Confirm closes both, errors close only the confirm). `PendingInvitations` bulk revoke got the same pattern (`confirmIds` state, red confirm). Gates + `impeccable detect` clean.

---

## 2026-10-05: Sign-out on the no-plant ConsoleGate card

**Gap:** `/console` with no assigned plant renders `ConsoleGate`'s "No plant assigned" card (`src/routes/console/route.tsx`) *before* `ConsoleShell` mounts - so operators/technicians without a plant had NO way to sign out (the header's Sign out button never rendered).

**Fix:** the gate card now renders its own Sign out button (`onClick={logoutHard}`, `LogOut` icon, ConsoleShell's pill styling) for every no-plant user **except** `system_admin` (`!hasMinRole(user.role, "system_admin")`), who instead gets the admin console launcher and stays signed in.

**Gotcha:** two logout flavours exist - `logoutHard()` (clears token + persisted state directly, `location.replace("/")` - use this in the console to avoid an empty-render flash) vs soft `logout()` (setState, used by mobile `AppShell`).

---

## 2026-10-05: System admin tenant card counts were fabricated + per-plant onboarding details (read-only)

**Bug 1 — `SystemTenantCard` counts:** cards showed `userCount` = users filtered from `GET /admin/users` **page 1, page_size=20** (platform-wide, so wrong for every tenant beyond the first 20 users) and `plantCount` = `stats.data.plants_per_tenant[tenant.id]` — a key backend `GET /admin/stats` **never returns** (`SystemStatsResponse` = totals + `tenants_by_status` + `users_by_role` only) → every card printed "0 plants". `normalizeStatsResponse`'s hedged `plants_per_tenant ?? {}` silently masked the mismatch.
**Fix:** `SystemTenantCard` is now self-sufficient — it calls the existing `useTenantStats(tenant.id)` (`GET /admin/tenants/{id}/stats` → `{total_users, active_users, total_plants, pending_invitations, users_by_role}`, role `plant_manager+`, system_admin passes) and renders `total_plants`/`total_users`, with `…` while loading. The `userCount`/`plantCount` props were deleted from the component and both call sites (Recent Tenants + Tenants tab), and the dead `plants_per_tenant` line was dropped from `normalizeStatsResponse`. The Tenants-tab header count was switched from "active users among page 1" to `stats.data.total_users total users` (accurate platform total).

**Feature — per-plant onboarding details, readable only:** new `src/components/admin/PlantOnboardingDetailsDialog.tsx`, mounted from a `ClipboardList` icon button on each `PlantCard` in the **system admin** tenant page (`console/admin/system/tenant/$tenantId/index.tsx`). Shows setup status badge (applied/partial/none — same areas+teams probe as the wizard's `checkPlantSetup`), location/timezone, area + line name chips, and teams with supervisor, member count and a human `shiftSummary()` for `shift_config` (`regular_day`/`rotating`/`extended_rotating`/`extended_day`/`night`). Reads `useAreas` + `useLines` + `usePlantTeamsDetail` (all `require_role("operator")` → system_admin OK); mounted conditionally so queries fire only while open.

**Gotchas:**
- Wizard-only metadata (`setupMode`, `preset`, `includeDemoData`, `setupApplied`, `lineShiftMode`) lives **only in localStorage `optilog.onboarding.v1` (24h, cleared on Done)** — it is never persisted server-side, so onboarding details can only be *derived* from live structure (areas/lines/teams), never read as stored form answers.
- `noPropertyAccessFromIndexSignature: true` — `Record<string, unknown>` fields must be bracket-accessed (`config["start_hour"]`), TS4111 otherwise.
- eslint on `admin-hooks.ts` / `system/index.tsx` still reports 12 pre-existing `no-explicit-any` errors — they predate this work; prettier drift in touched files was fixed with `npx eslint --fix`.
- PowerShell: quote paths containing `$` (`'src/routes/console/admin/system/tenant/$tenantId/index.tsx'`), otherwise `$tenantId` interpolates as an unset variable.

---

## 2026-10-05: Voice logging capped at supervisor + ManagerHome for shift_manager+

**Decision (user-confirmed):** the voice logging flow (`/` → timeline → end-shift → report) is a floor tool — **operator, technician, supervisor only** (`shift_manager` and above are out). Managers get a distinct mobile screen; team membership excludes plant_manager+.

**Shipped:**
- `src/lib/shift-log.ts`: two new gates next to `hasMinRole` — `canLogShift(role)` (`!hasMinRole(role, "shift_manager")`) and `canBeTeamMember(role)` (`!hasMinRole(role, "plant_manager")`).
- `src/routes/index.tsx` `Index()`: after the login check, `!canLogShift(user.role)` → `<ManagerHome />`, so shift_manager/plant_manager/integration_admin/system_admin never see StartShift/Record even with a persisted active shift.
- New `src/components/shift/ManagerHome.tsx`: greeting + role, read-only "Running now" card (`useShiftsNow` → shift window + team on shift; degrades to a plain card when no plant/no data), primary **Open operations console** button, secondary **Sign out**. Header actions come from `AppShell`.
- `src/components/shift/AppShell.tsx`: pending-sync badge + offline simulator toggle are now gated on `canLogShift` (they only mean something to loggers); console link + sign-out stay for everyone.
- Route guards in `timeline.tsx` / `end-shift.tsx` / `report.tsx`: `useEffect` redirect to `/` (replace) + `return null` when `state.user && !canLogShift(...)` — all hooks run before the early return (rules-of-hooks safe).
- `TeamMembersDialog` add-member candidates filter on `canBeTeamMember(u.role)` — plant_manager+ users never appear in the picker (they have no crew).
- `ConsoleShell` sidebar link relabels to "Mobile manager home" for non-loggers (still points to `/`).

**Gotchas:**
- The start-shift "Team" row needed no explicit hide: plant_manager+ can no longer reach `StartShiftScreen` at all — the team-row requirement is satisfied by the screen swap (answer was "Both").
- `hasMinRole` is `>=`, so "up to X" checks must be inverted (`!hasMinRole(role, "next_role")`) — there is no `hasMaxRole`.
- The 4 `no-explicit-any` errors in `index.tsx` (SpeechRecognition ambient decls, lines 18-21) and 12 in `admin-hooks.ts`/`system/index.tsx` are pre-existing — touched files are otherwise lint-clean after `eslint --fix`.

**Follow-up:** the same read-only `PlantOnboardingDetailsDialog` was added to the **tenant admin** plant cards too (`console/admin/$tenantId/index.tsx` PlantCard — identical ClipboardList button/state pattern as the system admin page). Its "use the onboarding wizard (Add Plant)" copy fits there naturally since that page owns the wizard route. Also cleaned the file's pre-existing prettier drift + `role as any` → `role as Role` so it lints clean.

---

## 2026-10-05: Onboarding wizard — "Seed with Preset" and "Skip" removed (UI-only)

**Decision (user-confirmed):** step 4 drops the three option cards; it becomes a **summary-only** step ("Review what onboarding will create, then apply it" + the areas/lines/teams/shift-type list) and `STEPS[4]` is renamed **"Seed Data" → "Apply Setup"**. Cleanup depth was explicitly **UI-only**: `SeedPresetSelector.tsx`, `useSeedPlant`, the `SeedPreset` type, `WizardData.preset`/`includeDemoData`/`setupMode`, `handleNext`'s preset/skip branches, the review-step preset/skip copy, and the step-4 button ternary all stay in the code (now unreachable but intact).

**Shipped (`src/components/admin/OnboardingWizard.tsx` only):**
- `EMPTY_DATA.setupMode` default `"preset"` → `"config"` — critical: with no cards to click, the only selectable path must be the default, or Next would silently run the preset seed.
- `handleResume` coerces saved drafts: `setData({ ...saved.data, setupMode: "config" })` — localStorage blobs ≤24h old can still carry `"preset"`/`"skip"`, which would diverge from the summary-only UI.
- Step-4 render: card grid + preset-selector/demo-checkbox + skip-warning blocks deleted; summary made unconditional; intro copy now "Review what onboarding will create, then apply it:".
- The wizard's now-unused `SeedPresetSelector` import removed (dead import = lint error; the component file itself remains).

**Gotchas:**
- "UI-only removal" still requires forcing the surviving branch (`default` + resume coercion) — hiding the selector without pinning `setupMode` leaves a state that applies a preset the user can no longer see.
- `tsc` + eslint (after `npx eslint --fix` for 2 prettier drift lines in `handleNext`) + `vite build` all green.

---

## 2026-10-05: Lines step rebuilt — count means TOTAL lines, not lines per area

**Bug report:** with 4 areas, toggling the Lines-step count 1 → 2 → 1 left the step showing **4 line rows**; user expected 1. Root cause was two compounding behaviors in `PlantSetupForm.tsx` (`setAllCounts`): (a) the control was **"Lines per area"** — it rebuilt `lines` as `areas.length × n`, so with 4 areas the box reads 1 while 4 rows exist; (b) an **initial-state asymmetry** — `EMPTY_DATA.lines` gives only area 0 one line, so areas added in step 1 start with 0 lines and the first touch of the count control "fills" every area, making `1 → 2 → 1` end with MORE total lines than it started with (looks like lines were created out of nowhere). Verified nothing was persisted (plant had 0 areas/0 lines in Mongo — setup only runs at Apply Setup).

**Decisions (user-confirmed):** count = **n lines total for the plant** (4 areas + count 1 → exactly 1 line record); the 4 areas are **zones along the line** (not parallel departments); lines attach to the **first area** (backend `LineSetup.area_index` is required — `admin/service.py` maps it to `area_id`, so a line must own exactly one area; "line spans all zones" would need `area_id` optional + Layout/Data-tree/ picker changes — explicitly out of scope).

**Shipped:**
- `PlantSetupForm.tsx` Lines step: `setAllCounts` (per-area rebuild) → `setLineCount(n)` creating exactly `n` entries `{name: lines[i]?.name ?? \`Line-${i+1}\`, areaIndex: 0}` — also fixes a pre-existing quirk where ANY count change reset renamed lines (old lookup matched only default `Line-i` names); input relabeled **"Number of lines"** with `value={lines.length}`; per-area cards replaced by a flat list + zones caption. Areas-step copy updated to zones wording.
- Teams step: grouped `"Zone › lines | ..."` line summary → plain comma list; assign-line chips dropped the `{areaName} › ` prefix (all lines share area 0 now).
- `OnboardingWizard.tsx`: new `normalizeLines()` applied in `handleResume` alongside the `setupMode` coercion — dedupes by name (order-preserving), forces `areaIndex: 0`, falls back to `[{name:"Line-1", areaIndex:0}]`. This migrates in-flight drafts saved by the old per-area logic: `[Line-1 ×4]` → 1 line, `[L1,L2,L1,L2]` → 2 lines (recovers the user's intended total from their stuck draft).
- Pre-existing lint debt in the touched file cleaned: 214 prettier-drift errors via `eslint --fix`, and the 3 `no-explicit-any` (`normalizeArrayResponse(response: any)` → `unknown` + envelope cast; `api.get<any>` copy-areas → `api.get<unknown>` + typed generic — note the old helper returned the raw object when `items`/`data` were absent, which would have crashed `.map`; the new one returns `[]`).

**Gotchas:**
- Resume-time migrations are the only defense for old localStorage drafts (24h TTL) — every semantic change to `WizardData` needs a coercion in `handleResume`, next to `setupMode: "config"`.
- Backend accepts the new shape unchanged (payload keeps `areaIndex: 0`); `PlantSetup`, `canNext`, Apply summary (`namedLines = lines.length`) and `assigned_line_indices` all keyed off `lines` directly, so they follow the new semantics with no edits.
- Consequence accepted: in Layout/Data tree the line renders under the FIRST area's section only; other zones show no line columns. `PlantSetupForm.tsx` still has 3 pre-existing `react-refresh/only-export-components` warnings (value exports alongside components) — left alone.
- Gates: `tsc` clean, `eslint` 0 errors, `vite build` exit 0.

---

## 2026-10-05: Schedule tab — highlight the current shift cell

**Request:** "In schedule tab, highlight the current shift card." Clarified with the user: the target is the **single weekly-grid cell** where today's column meets the row of the team working RIGHT NOW (not today's whole column, not the strip), styled as **"a color that pops from the rest, no need for text"** (no "Now" badge), and **no highlight at all when nothing is running** (`current_shift` null / team unknown).

**Shipped (`src/routes/console/schedule.tsx` only):**
- `useShiftsNow(plantId)` added to the hook block (before the `if (!plantId)` early return — rules-of-hooks); `currentShift = shiftsNow.data?.current_shift ?? null`.
- Per-cell `isCurrent = !!currentShift && !!day && pt.team_id === currentShift.team?.id && col === currentShift.date`; rendered as `isCurrent && "ring-2 ring-success"` placed AFTER the existing `col === today && "ring-1 ring-primary/40"` in the `cn()` so tailwind-merge's last-wins upgrades the today column's faint amber ring to a solid green one.
- Color choice: the theme token `--color-success` (oklch green, `src/styles.css:108`) — already the "running" color in `CurrentShiftBanner` (`text-success`) — pops against the yellow/orange/indigo/sky cell tints without text. `ring-success` works because Tailwind v4 generates ring utilities from `@theme` color tokens.
- Gated on `day` (a current shift with no pattern cell would otherwise ring a disabled dimmed "—" cell); `team === null` naturally matches nothing (`undefined === pt.team_id` is false), satisfying the no-fallback decision. 60s poll + `retry: false` come free from the hook.

**Gotchas:**
- `useShiftsNow` types (`CurrentShift.date`, `NowTeam.id`) were already corrected in the 2026-10-03 shape-mismatch fix — no new contract risk; the cell highlight is read-only and degrades to "nothing highlighted" on any mismatch (e.g., `date` off from the local `cols` strings), same philosophy as the banner/pill.
- Prettier drift in the file (5 errors, 3 of them pre-existing elsewhere in the file) fixed with `npx eslint --fix`; gates: `tsc` clean, eslint 0 errors, `vite build` exit 0.

---

## 2026-10-05: Layout tab rework — searchable people rail + zones strip + flat line columns

**Requests (user-confirmed via questions):** (1) unassigned people as a **vertical, searchable panel**; (2) a **better plant-structure view** now that the lines model is resolved (areas = zones along the line; every `Line.area_id` points at the FIRST area); (3) rail = **sticky right rail**; structure = **zones strip + flat line columns**; (4) rail stays **manage-only** (supervisor+, same as the old pool section).

**Shipped (`src/components/console/LayoutBoard.tsx` + 1 subtitle line in `src/routes/console/layout.tsx`):**
- **Shell:** `grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]` (second column only when `canManage`, so view-only users don't get an empty 288px gutter); main child has `min-w-0` — required or the line columns' `overflow-x-auto` stretches the grid track instead of scrolling. Below `xl` the rail stacks last (old pool position).
- **Rail:** card with title + count (`tabular-nums`, switches to `3 / 12` while filtering), search input (`h-9 rounded-lg border bg-secondary … focus:border-ring`, same pattern as `TeamMembersDialog`), then the droppable list (`poolRef` moved here from the section; `max-h-[calc(100vh-14rem)] overflow-y-auto`). Filter is case-insensitive over `name`/`email`/`role`; empty states distinguish loading / everyone assigned / no match. `PoolChip` restyled from a wrap chip to a full-width vertical row (name + 11px uppercase role chip per chip-source spec, `role.replace(/_/g," ")`); drag data (`instance:"pool"`) unchanged.
- **Structure:** per-area sections (which rendered area 1 full + areas 2..n as empty headers under the new model) replaced by (a) a **zones strip** — numbered area chips joined by `ArrowRight` in API order under an uppercase "Zones along the line" label — and (b) **one flat row of every `LineColumn`** (`groups.flatMap(g => g.lines)`); header now carries `N zones · N lines · N teams` in `tabular-nums`. `LineColumn` gained optional `areaName` shown only when `lines` span >1 `area_id` (legacy multi-area plants get a tag; the uniform new-model case stays clean).
- Coverage `Lines…` popover flattened (dropped the meaningless single "AREA 1" group header); structure caption, empty state, and route subtitle reworded to zones.

**Gotchas:**
- `exactOptionalPropertyTypes: true` — an optional prop receiving an explicit `string | undefined` expression must be typed `areaName?: string | undefined`, not `areaName?: string` (TS2375).
- The rail's `xl:sticky xl:top-24` is sized to clear the console's sticky header (~80px: `py-4` + h1 + subtitle); if the header grows, revisit the offset.
- Grid + `overflow-x-auto` children always need `min-w-0` on the track child — classic CSS-grid blowout, caught before runtime by knowing the rule, not by the typechecker.
- Gates: `tsc` clean, eslint 0 errors (136 indent-drift errors fixed via `--fix`), `vite build` exit 0. DnD handlers, tray, dialogs, and hooks untouched — no API surface changes.

---

## 2026-10-05: Layout board pool scoped to THIS plant; team drop carries the plant (backend spec)

**Requests (user-confirmed via questions):** (1) the Layout board's people pool should only offer users who belong to the current plant (plus tenant users with no plant yet), excluding users assigned to other plants; (2) apply the same scope in `TeamMembersDialog`; (3) write the backend contract as a spec note in `optilog-backend/notes/` rather than patching users from the frontend.

**Shipped (frontend):**
- `src/lib/hooks.ts`: `DirectoryUser.plant_ids?: string[]` (optional on purpose -- an older backend omitting the field degrades to "show everyone", so the pool never empties) plus exported `inPlantScope(u, plantId)` shared by both call sites: `undefined`/empty `plant_ids` => in scope, else membership check.
- `src/components/console/LayoutBoard.tsx`: split the old single filter into `activeUsers` (active + not on a team) then `poolUsers = activeUsers.filter(u => inPlantScope(u, plantId))` -- the `N available` count and the search filter both run off `poolUsers`; empty state now distinguishes "No unassigned people in this plant." (others exist but are scoped out) from "Everyone is assigned to a team."; rail hint gained "Only people in this plant (or with no plant yet) are listed."
- `src/components/console/TeamMembersDialog.tsx`: `inPlantScope(u, plantId)` added to the `candidates` filter (next to `canBeTeamMember`) -- used by both the Teams and Schedule pickers, so cross-plant add-member is blocked everywhere at once.
- No frontend write on drop: `useSetTeamMembers` already invalidates `["users","directory"]` (`hooks.ts:674`), so the pool refetches with the new `plant_ids` once the backend ships A1.

**Backend spec note:** `optilog-backend/notes/TEAM_MEMBER_PLANT_SPEC.md` (status: open). Contract -- in `set_team_members` (`app/domain/teams/service.py:197`), after the membership write, `$addToSet: {plant_ids: team_doc["plant_id"]}` for ALL current member oids: add-only, never strips other plants, never touches removed members, idempotent (self-heals pre-existing members), no new endpoint/permission. `team_doc["plant_id"]` is already an ObjectId so no conversion. Frontend degrades cleanly until applied (drop works, plant grant lands later).

**Live verification (backend running on :8000):**
- `GET /users` DOES return `plant_ids` for every item (login as `tenant-admin@optilog.com`, endpoint prefix is `/api/v1` -- a bare `/auth/login` 404s).
- Directory of that tenant: 26 users, 23 plantless (in scope), 3 with plants -- `pm-1`/`tenant-admin` share the logged-in plant (shown), `pm-2` is on a different plant (excluded), proving the filter discriminates.

**Gotchas:**
- System admin's `GET /users` directory returns `total=0`: `list_users` filters `tenant_id: None` and the bootstrap admin has `tenant_id: null` -- pre-existing, unaffected by this change.
- Dev-smoke parsing: Vite's ready line wraps the port in ANSI escapes (`localhost:<bold>8081`), so regexes like `localhost:(\d+)` fail -- use `localhost:\D*(\d+)` or read the raw line.
- `hooks.ts` still reports 5 pre-existing lint errors (`api.get<any>` x3 at 612/646/935, prettier drift at 713/978) -- all outside the two hunks this task touched; `LayoutBoard.tsx`/`TeamMembersDialog.tsx` are prettier + eslint clean.
- Cross-plant drag-ins from the board are now impossible by design (accepted consequence); such a user must be moved by an admin first.
- Gates: `tsc` clean, `vite build` exit 0, eslint/prettier clean on touched components, live smoke `/`, `/console`, `/console/layout` all 200 on the dev server (port 8081; 8080 was occupied by a stale dev process, now killed).

---

## 2026-10-05: Operator start screen — Area -> Line pick, persisted with shift + events

**Requests (user-confirmed via questions):** (1) the mobile start screen gets an explicit **area selector** — options = the blueprint-created plant areas (NOT team-restricted), presented as **Area select -> cascading Line select**; (2) the pick must be **persisted server-side** (shift + events), not just local state; (3) console: **show each team's covered area(s) on the Layout TeamCard** (editing stays Layout-only); (4) **fix the pre-existing End Shift breakage** in this pass. Defaults come from config (current shift's `line_id`, else the team's `assigned_line_ids` from Layout) but stay adjustable before Start Logging.

**Shipped (frontend):**
- `src/lib/shift-log.ts`: `ShiftState.areaId`/`.area` (+ `initialState` defaults so old `shiftlog.state.v1` blobs hydrate clean), `ShiftEvent.line_id?`/`.area_id?`, new `startLoggingSession(shiftId, lineId, areaId)` -> `POST /operator-shifts/start` (fire-and-forget: 409 = already active, offline must not block), and the `endShift()` fix — `handover` sent as a **plain string** (the old `{summary, open_items}` object was rejected with 422 by `ShiftEnd.handover: Optional[str]` before the handler ran; `operator_id` dropped) plus a best-effort session start first so there is a session to close.
- `src/routes/index.tsx` `StartShiftScreen`: single mislabeled line `<select>` ("Production area" whose `optgroup`s were **dead** — plant-level `GET /plants/{id}/lines` omits `area_id`, LAYOUT_SPEC A8) replaced by Area + Line selects driven by `usePlantLinesByArea`; `canStart` = shift loaded + structure loaded + (no areas configured OR area chosen AND (area has no lines OR line chosen)); prefill effect guarded by a `useRef` so the config hint never snaps back over an operator's cleared choice; changing area clears a line that isn't in it; carryover block now gates on the area; `groups` wrapped in `useMemo` (else `exhaustive-deps` warns the `?? []` literal changes identity every render). `commit()` — the single choke point for voice/manual/edit/confirm saves — stamps `line_id`/`area_id` from state onto every event.
- `src/components/console/LayoutBoard.tsx` `TeamCard`: deduped covered-area names derived from `assigned_line_ids -> line.area_id` rendered as a secondary chip next to the coverage pill (`Zone A` / `Zone A +2`, full list in `title`).

**Shipped (backend, spec `optilog-backend/notes/AREA_LINE_LOGGING_SPEC.md`):**
- `ShiftEventCreate` += `line_id?`, `area_id?`; `create_event` stores both as Oids; events `FK_FIELDS` += both (timeline/list serialize them); `escalate_event` prefers the stamped line over asset lookup.
- `OperatorShiftStart` += `line_id?`, `area_id?`; `start_operator_session` stores them; its `FK_FIELDS` += both. Endpoint stays `require_role("operator")` (mobile-capable).
- Read side needed **no** dashboard change: my-events/events list already prefer `e.get("line_id")` over the asset-derived one.

**Gotchas:**
- Events previously had **zero** line linkage from mobile: the client posts `asset` (name string) while `ShiftEventCreate` expects `asset_name`, so it was silently dropped — the stamped `line_id` is the first real binding. Watch for other silently-dropped fields (`duration_minutes` vs `duration_seconds` is a pre-existing mismatch).
- `POST /operator-shifts/start` existed since forever but **no frontend code ever called it** — that's why `POST /shifts/{id}/end` 404'd (no session to close). Second start still 409s by design; the frontend swallows it.
- Verify a pydantic mismatch cheaply before trusting it: `python -c "from app.schemas... import X; X(field={'a':1})"` (pydantic 2.13 rejects dict-for-str -> FastAPI 422 pre-handler).
- Live smoke against the running `--reload` uvicorn worked end-to-end (session ids round-trip, timeline returns event ids, end 200) and the test event was deleted afterwards; a closed session doc + `operator_ids` entry remain on shift `6ac29658f547e57f92febbd0` (noted in the spec).
- `npm run dev` port regex failed again even with `\D*` (cmd-redirected log encoding) — just read `devlog.txt` raw for the port; 8080 was busy again, server took 8081.
- Gates: `tsc` clean, eslint/prettier clean on touched files (index.tsx keeps its 4 pre-existing SpeechRecognition `any`s), `vite build` exit 0, backend `pytest tests -q` = **235 passed** (4 new in `tests/api/test_area_line_logging.py`), dev smoke `/` + `/console/layout` 200.

---

## 2026-10-06: On-shift gate + supervisor-approved off-shift logging

**Requests (user-confirmed via questions):** (1) off-shift = plant shift-pattern window matches now AND the caller's team decides (in-window doc, or rotation assigns, or no rotation config = all teams share windows); (2) blocked operators get a **cross-device request+approve** flow (supervisor of the on-shift team approves from their own device, operator polls); (3) supervisors always bypass; (4) enforce frontend gate + backend guard on `POST /operator-shifts/start` (events stay open for offline sync); (5) show current shift + on-shift team on the start screen; (6) no active window -> **any supervisor** may approve; follow-ups: on-shift team without a `supervisor_id` -> any supervisor still approves (never dead-end), operator 403 path verified by pytest only (no operator creds).

**Shipped (backend, spec `optilog-backend/notes/ON_SHIFT_GATE_SPEC.md`):**
- `app/domain/shifts/on_shift.py` `get_on_shift_context()` = the single gate: pattern window + team via `$or: [{member_ids}, {supervisor_id}]` + evidence (open in-window doc = on; closed doc = off; else rotation-assigns or no rotation). Read-only. Returns `teams_on_shift` (rotation-assigned + open-doc teams; ALL teams when no rotation) and `rotation` for approve validation. `get_current_shift` was refactored onto it and gained `on_shift` / `next_shift` / `teams_on_shift`; Branch C reordered: in-window -> (rotation ok) create-in-window -> (rotation excludes) future-or-pending, fixing the old "future shift as current" fallback. `team_rotating_shift_type()` extracted to `app/workers/shift_generator.py` and reused by `get_plant_shift_now` (dedup, no drift).
- New `logging_approvals` collection + `app/domain/logging_approvals/service.py` + `app/api/v1/logging_approvals.py`: create/mine/pending/approve/deny; 15-min decision window, fresh 15-min usage window on approve, single-use `used`; lazy expiry flips stale `pending` AND `approved` docs (an approved-but-stale doc would otherwise validate forever). Approve restricted to on-shift-team supervisors when a window is active (empty supervisor set = fallback to any).
- `POST /operator-shifts/start` guard (`authorize_shift_start`): supervisor+ bypass -> on-shift -> `approval_id` validation (403 with actionable detail otherwise); approval is consumed only AFTER the session insert, so a 409 conflict keeps it usable. Sessions stamp `approval_id`/`approved_by`.

**Shipped (frontend):**
- `hooks.ts`: `CurrentShiftResponse` += optional `on_shift`/`next_shift`/`teams_on_shift` (optional = fail open on an older backend); `useMyLoggingApproval` (4s poll while pending), `usePendingLoggingApprovals` (8s), create/approve/deny mutations invalidating the `["logging-approval"]` prefix key.
- `shift-log.ts`: `startLoggingSession(..., approvalId?)` -> `approval_id`.
- `routes/index.tsx` `StartShiftScreen`: always-on "Running now: <shift> - <team> on shift" banner (`useShiftsNow`); `blocked = on_shift === false && role < supervisor` folded into `canStart`; block card with the approval state machine (request/waiting/approved/denied/expired, optional reason, offline hint) that keeps area/line pickers usable; supervisor inbox with Approve/Deny; removed the dead `teamMismatch` warning; pending-shift banner hidden while blocked.

**Gotchas:**
- `ShiftPatternCreate` caps `end_hour` at **23** - `time(24)` raises, so tests seed three rows `0-8/8-16/16-0` (union = every hour) instead of freezing time; a 0-24 pattern is API-illegal.
- mongomock tests: `get_current_shift` previously had ZERO test coverage, so the guard change broke exactly the 2 tests that POST `/operator-shifts/start` (they seeded no pattern and empty `member_ids`) - expected, fixed by seeding both. Final suite: **253 passed**.
- Frontend fail-open detail: gate keys off `on_shift === false` (not `!== true`) so a missing field from an older backend cannot brick the start screen; same idea for `teams_on_shift` typing (optional).
- `invalidateQueries({queryKey: ["logging-approval", plantId]})` would NOT match `["logging-approval","mine",plantId]` (position-1 mismatch) - use the bare prefix `["logging-approval"]`.
- Approve/deny use `require_role`, NOT `require_desktop` - a mobile supervisor must be able to approve from the start screen.
- Live smoke (tenant-admin): new `/shifts/current` fields returned, create -> 409 dup -> pending list with `operator_name` -> approve -> `mine=approved`, start as plant_manager bypasses (`approval_id: null`). Vite dev smoke `/` 200 on 8081 (8080 busy); read `devlog.txt` raw for the port (ANSI).
- Gates: `tsc` clean, eslint only pre-existing `any`s (hooks.ts 612/646/1033, index.tsx 18-21), prettier clean after `--write`, `vite build` exit 0, backend `pytest tests -q` = 253 passed (18 new).

## 2026-10-07 - Removed prefilled admin login credentials

**Request:** "I don't want the admin login details placeholder anymore" -> clear the demo prefill on the login form.

**Shipped:** `src/routes/index.tsx` `LoginScreen` email/password `useState` initial values changed from `admin@optilog.com` / `admin123456` to `""` (no placeholder attributes exist on those inputs, so the prefilled values were the only "details"). `PRODUCT.md` "Demo credentials are pre-filled" line replaced with "The login form starts empty".

**Gotchas:** `.impeccable/critique/2026-09-26T22-06-05Z__src.md` P1 still references the old prefill (stale artifact, left as-is); grep for `admin@optilog` if credentials ever reappear.

---

## 2026-10-08: End-of-shift rework + Console Approvals (Calendar merged into Schedule)

**Requests (user-confirmed):** full event summary on end-shift · edit/delete bad transcriptions (timeline + end-shift) · post-end navigation/guards · auto-end when the plant shift window closes (**prompt-then-close**: block recording, operator taps End Shift) · land on `/timeline` after end · operators may delete their own events (relax backend DELETE) · **new Console Approvals tab** (report approvals, confirm/resolve, push-to-maintenance, RCA on breakdowns) + **Calendar folded into Schedule** · queue scope = pending-approval shifts + today's unresolved events. Handover redesign, "Share PDF" (hidden, not built) and per-shift report approval were left as documented assumptions.

**Shipped (frontend):**
- `shift-log.ts`: `ShiftEvent.operator_id?`; `ShiftState` += `deletedIds`/`pendingDeletes`/`windowEnd`; `addEvent` stamps `operator_id`; local-first `saveEvent` (PATCH), `deleteEvent` (server DELETE when synced+online else `pendingDeletes`), `syncPending` flushes deletes first, `mergeEvents` filters `deletedIds`/`status:"deleted"`, `endShift` treats 404 as success.
- `routes/end-shift.tsx` (rewritten): full event list via `TimelineEventRow` + `PlanMaintenanceDialog`, inline `EventEditor` shell, window-closed banner, lands on `/timeline`, bottom block switches on `state.endedAt` ("View shift timeline"/"Open report" vs "End Shift"/"Not yet").
- `routes/timeline.tsx`: row actions + `ShiftSummaryCard` + footer CTA; single top-level `useShiftWindow`.
- `routes/index.tsx`: `Index()` returns `<ShiftEndedScreen/>` when `state.endedAt` (tiles, handover card, approval badge, resume only when same shift && window running); `handleStart` calls `syncPending()` first and resets `events/deletedIds/endedAt/reportApproved/handover/windowEnd`; `RecordScreen` hydrates `windowEnd` and hard-stops recording when `shiftWindow.over`.
- `routes/report.tsx`: approve goes through `useApproveShiftReport` (server) then local `approveReport`, badge reads `state.reportApproved || shift.report_approved_at`, dead "Share PDF" removed.
- Console: new `routes/console/approvals.tsx` (stats + report rows with Approve/Unapprove + event rows with Confirm/Resolve/Push-to-maintenance/Start-RCA → `/console/rca?incident=`), `ScheduleMonthView.tsx` (month grid extracted from the old Calendar route), `schedule.tsx` gained a Week/Month toggle, `ConsoleShell` NAV is now a typed `NavItem[]` with `minRole` (Approvals = supervisor, badge = pending reports via `useReportApprovals`) and dropped the Calendar link; `routes/console/calendar.tsx` deleted; `rca.tsx` takes `?incident=` via `validateSearch`.

**Shipped (backend):**
- `workers/shift_activator.py`: passes a synthetic `{user_id: None, tenant_id, role: "system_admin"}` to `close_shift` (the old `str(tenant_id)` arg raised TypeError that the broad `except` swallowed — no shift ever auto-closed) and stamps `operator_shifts.ended_at`.
- `events.py` DELETE relaxed to `require_role("operator")` + passes `user`; `delete_event` allows owners or supervisor+; `list_events` excludes `status:"deleted"` unless explicitly requested.
- Deleted-event filters added across `dashboard/service.py` (plant summary, recent/my/shift/incident events, carried-over issues, aggregates) and `shifts/service.py` (close-shift counts/downtime, timeline).
- `plan_maintenance_for_event` + `POST /shifts/{id}/events/{eid}/plan-maintenance` (supervisor): creates `actions` `type="maintenance_intervention"` and flips the event to `planned_maintenance`; `approve_shift_report` + `POST /shifts/{id}/report/{approve,unapprove}`; `GET /plants/{id}/shifts/report-approvals` (queue, merges `operator_shifts.handover`, counts a shift as ended on `actual_end` or closed/handed_over); `actions.py` `type` Query alias; `rca.py` `data: RCACreate = RCACreate()` so an empty body no longer 422s; `get_my_events` payload += `operator_id`/`operator_name`.

**Gotchas:**
- `exactOptionalPropertyTypes: true`: optional props need `?: T | undefined`, `{ exact: boolean | undefined }` is still rejected by TanStack `ActiveOptions` (use `?? false`), and `search.incident` on a `validateSearch` result is an index-signature access → `search["incident"]`.
- React hooks must all run before any early `return` (a duplicated `useShiftWindow` below an early return in timeline.tsx threw `React Hook "useShiftWindow" is called conditionally`).
- Whole-repo `npm run lint` has ~6200 pre-existing CRLF/prettier errors — gate with `npx eslint --fix <touched files>` instead; `tsc` alone takes ~3–4 min (don't cap it at 180s).
- PowerShell `-replace` + `Set-Content` can mangle UTF-8 — prefer the `edit` tool; verify with a UTF-8 round-trip check after any script-based rewrite.
- `npm run build` regenerates `routeTree.gen.ts`, so delete a route file and build (not just `tsc`) to drop it.
- Backend: 19 new tests in `tests/api/test_shift_lifecycle_and_approvals.py` (worker, delete ownership, deleted filters, plan-maintenance, RCA empty body, report approve/queue) → `pytest tests -q` = **317 passed**.

---

## 2026-10-08: Self-learning vocabulary — plant fields, recording link, AI lesson review

**Requests (user-confirmed):** implement the FRONTEND_NOTES 2026-10-08 changelog row (4 items: plant `industry`/`key_terms`/`language_notes`, AI-lessons API, `correction_suggestions`/`transcript_original`, `PATCH /recordings/{id}/transcript`) · plant fields go on the **Onboarding Wizard + both admin PlantEditForms** (no read-only display surface) · lessons queue = **a section inside `/console/approvals`** (user demanded justification first — justification accepted) · transcript fix = "Frontend + tiny backend link" · recording upload = **fire-and-forget** (never block `commit()`).

**Shipped (frontend):**
- Vocabulary fields: `AdminPlant` (shift-log) + `Plant` (hooks) += `industry`/`key_terms`/`language_notes` (all optional → older backends still typecheck), new `PlantPayload` in admin-hooks behind `useCreatePlant`/`useUpdatePlant`, `WizardData`/`EMPTY_DATA` + resume spreads `...EMPTY_DATA` underneath the saved draft (old localStorage drafts lack the keys → uncontrolled-input warnings otherwise), wizard step-0 UI (industry `maxLength=120`, new `KeyTermsInput` chip editor ≤50 terms × 60 chars with Enter-to-add/remove, `language_notes` textarea 500), and both duplicated `PlantEditForm`s (identical markup; submit passes the trio straight into `updatePlant.mutate(data)`).
- `correction_suggestions`: `TranscribeResult.structured_event` is now `StructuredEvent | null` (+ `CorrectionSuggestion`); the transcribe handler guards with `const se = result.structured_event ?? {}`; new `corrections` state on `RecordScreen` renders tappable **heard → corrected** chips under the Transcript block on the confirm screen (`draft.transcript.replace(heard, corrected)` + chip removal); cleared on new take / commit / confirm-back.
- Recording link: the upload moved out of `commit()` into `mediaRecorder.onstop` and runs in parallel with `transcribeAudio` (now also sending `plant_id`/`shift_id`); results live in `recordingPromiseRef` + `settledRecordingIdRef`. `commit()` reads the settled id (no await), stamps `recording_id` onto the event, and — if the upload is still in flight — chains a fire-and-forget `api.patch('/events/'+serverId, {recording_id})`. Refs reset on start / commit / confirm-back so an abandoned take can never attach to a later manual entry. `addEvent` returns the server id (`Promise<string | null>`); `mapMyEventToShiftEvent` maps `source_record_id → recording_id` (revives `PlayAudioButton`, previously dead code).
- `RecordingBlock` (TimelineEvent.tsx) replaces the transcript block: `useRecording` + `useFixTranscript`, struck-through **Original ASR** when `transcript_original` exists, "still processing"/"could not be processed" copy, play-audio whenever `recording_id`, and a Fix-transcript textarea → `PATCH /recordings/{id}/transcript` → query-cache update.
- Approvals: 4th StatCard (grid `sm:grid-cols-2 xl:grid-cols-4`), vocabulary section after Shift reports (status chips, `trigger → correction` rows with kind/hits/source/last-seen, Verify + **armed** Reject through the existing `run()`/`pendingId`/`actionError`, inline Add-term form with the trigger field hidden for `kind="term"`), new hooks `useAILessonsByStatus` / `useLessonsToReview` (fetches exactly `suggested` + `ineffective`) / `useAddAILesson` / `useVerifyAILesson` / `useRejectAILesson`; ConsoleShell Approvals badge = `pendingReports + lessonsToReview.total`.

**Shipped (backend):**
- `ShiftEventCreate.recording_id?` (api/v1/shifts.py) → `recording_source(recording_id, tenant_id)` (new, events/service.py) validates the recording belongs to the tenant and returns `{type: "voice", system: "optilog", record_id}` or `None` (invalid/foreign/unknown ids are dropped silently — the client retries with a PATCH). `EventUpdate.recording_id?` is popped in `update_event` and **merged into the existing source** so an AI-extracted event keeps `type: "ai"` (the vocabulary-learning hook keys off it).
- 3 new tests in `tests/api/test_shift_lifecycle_and_approvals.py`: create-time link (+ the revived `/events/{id}/audio` endpoint, asserted with `settings.r2_public_url` stubbed so boto3 never runs), late PATCH link, and unknown/foreign ids dropped.

**Gotchas:**
- **Pre-existing id mismatch (follow-up, out of scope):** local event ids are `evt_<ts>_<rand>` while the server mints ObjectIds, so `POST /recordings`'s `event_id` form field was *always* ignored (the endpoint has no such param) and `saveEvent`/`deleteEvent` PATCH/DELETE local ids → 404s that are swallowed. The create-time `recording_id` link fixes audio; full id reconciliation remains open.
- Moving the upload to `onstop` means a take the operator backs out of still uploads (previously only confirmed takes did) → orphan recordings in storage; acceptable under the approved fire-and-forget design, but a cleanup policy is eventually needed.
- Lesson mechanics: only `auto_verified|verified` feed prompts; `suggested` = confidence < `lesson_auto_verify_confidence` (model default 0.6) or `external`, `ineffective` = `recurrence_count ≥ 3` — hence the queue fetches exactly those two statuses rather than "everything not rejected".
- Verify/reject endpoints are `require_desktop("supervisor")` → 403 in a mobile browser; surfaced through the page's shared `actionError`.
- PowerShell `Add-Content` defaults to ANSI in 5.1 and mangled every `→`/`—`/`≥` in this entry — truncated the damage with `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` and re-appended with the `edit` tool.
- Gates: `tsc` clean (re-run *after* `npm run build`, which regenerates `routeTree.gen.ts`), eslint on touched files = only pre-existing `any`s (admin-hooks ×9, hooks 618/652/1094, index 18-21), `vite build` exit 0, backend `pytest tests -q` = **320 passed** (3 new).
