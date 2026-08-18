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
