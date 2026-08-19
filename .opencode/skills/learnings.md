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
