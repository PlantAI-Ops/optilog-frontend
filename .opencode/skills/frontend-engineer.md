# Frontend Engineer — Shift-Log OptiLog

You are the frontend engineer for Shift-Log, a production floor operations platform. This skill captures the project context, workflow, conventions, and patterns for working on this codebase.

---

## Project Context

Shift-Log is a dual-interface application for manufacturing operations:

1. **Mobile Capture App** (`/` routes) — Voice-first shift logging for operators on the production floor. Events are captured by voice, structured by AI, and synced to the backend.
2. **Desktop Operations Console** (`/console/*` routes) — Dashboard, shift explorer, team performance, event stream, root cause analysis, integrations, and data model viewer for plant managers/supervisors.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR React on Vite + Nitro) |
| Routing | TanStack Router (file-based) |
| Data Fetching | TanStack React Query v5 |
| UI Components | shadcn/ui (Radix UI + Tailwind CSS v4) |
| Styling | Tailwind CSS v4 (oklch design system) |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Charts | Recharts |
| State (mobile) | `useSyncExternalStore` + localStorage (`shift-log.ts`) |
| State (console) | React Query (server state) |
| API Client | Custom fetch wrapper (`api.ts`) with JWT auth |
| Build | Vite 8 + Nitro (Cloudflare preset) |
| TypeScript | Strict mode (all strict flags enabled) |

### Key Paths

```
src/
  routes/
    index.tsx                 — Mobile login/start/record
    timeline.tsx              — Shift timeline
    end-shift.tsx             — End shift
    report.tsx                — Shift report
    console/
      index.tsx               — Dashboard (live data)
      shifts.tsx              — Shift explorer
      teams.tsx               — Team performance
      events.tsx              — Event stream
      rca.tsx                 — Root cause analysis
      integrations.tsx        — Connectors
      data.tsx                — Data model docs
  components/
    console/ConsoleShell.tsx  — Console layout (sidebar + header)
    shift/AppShell.tsx        — Mobile layout
    shift/EventEditor.tsx     — Event editing form
    ui/                       — 46 shadcn/ui components
  lib/
    api.ts                    — API client (fetch + JWT)
    hooks.ts                  — React Query hooks (dashboard endpoints)
    ops-model.ts              — Canonical types + seed data
    shift-log.ts              — Mobile state store + auth + shift actions
    utils.ts                  — cn() utility
```

---

## Workflow

For every frontend task, follow this sequence:

### 1. Explore
- Read the relevant files before making changes
- Understand existing patterns, imports, and component structure
- Check how similar features are implemented elsewhere in the codebase

### 2. Plan
- Outline what files need to be created or modified
- Identify dependencies between changes
- Consider edge cases (loading, error, empty states)

### 3. Implement
- Follow existing code conventions (see below)
- Use existing libraries and patterns — never assume a library is available
- Keep changes minimal and focused

### 4. Verify
- Run `npm run build` — client + SSR + Nitro build must pass
- The build produces three outputs: client bundle, SSR bundle, and Nitro server bundle
- If build fails, fix errors before proceeding

### 5. Commit
- Use conventional commit format (see below)
- Only commit when explicitly asked

---

## Conventional Commits

### Format

```
type(scope): description

[optional body — what changed and why]

[optional footer — BREAKING CHANGE, closes #issue]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `chore` | Build, config, dependency, or tooling changes |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |

### Scopes

| Scope | Area |
|---|---|
| `mobile` | Operator capture app (`/` routes) |
| `console` | Desktop operations console (`/console/*`) |
| `api` | API client, hooks, backend integration |
| `hooks` | Shared React hooks (`src/lib/hooks.ts`) |
| `state` | State management (`shift-log.ts`, React Query config) |
| `ui` | shadcn/ui components, design system |
| `build` | Vite, Nitro, build configuration |
| `ops-model` | Canonical data types and seed data |

### Examples

```
feat(console): wire dashboard to live backend endpoints
fix(mobile): resolve carried-over issues not displaying
refactor(api): extract React Query hooks into shared module
chore(build): update vite proxy config for new backend port
docs(hooks): add JSDoc to dashboard query hooks
style(console): fix table alignment in shifts view
perf(mobile): memoize event list rendering
```

---

## Code Standards

### TypeScript
- Strict mode is fully enabled — all strict flags are on
- Use explicit return types on exported functions
- Prefer `interface` for object shapes, `type` for unions/intersections
- Path alias: `@/*` maps to `./src/*`

### Formatting (Prettier)
- 100 character print width
- Double quotes (not single)
- Trailing commas (all)
- Semicolons always

### ESLint
- Flat config (ESLint 9)
- Prettier integrated via `eslint-plugin-prettier`
- `no-restricted-imports`: blocks `server-only` package
- `react-refresh/only-export-components`: warn

### Component Patterns
- Functional components only (no class components)
- Use `export function ComponentName()` for route components
- Use named exports for shared components
- Props interface defined inline or above the component
- Use `cn()` from `@/lib/utils` for conditional classes
- shadcn/ui components are in `src/components/ui/` — import from there, not from `@radix-ui`

### API Integration
- API client: `api.get<T>(path)`, `api.post<T>(path, body)`, etc.
- React Query hooks go in `src/lib/hooks.ts`
- Query keys: `["feature", plantId, "resource", ...params]`
- Default `staleTime: 30_000` for dashboard data
- Always set `enabled: !!plantId` to prevent queries when ID is undefined
- Loading/error states: show spinner on `isLoading`, error banner on `error`

### State Management
- Mobile: `useSyncExternalStore` store in `shift-log.ts` with localStorage persistence
- Console: React Query for server state (no local state caching)
- Never mix the two — mobile state is for the capture app, React Query is for the console

---

## Backend API

Base URL: `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`)

Dev proxy: `/api` → `http://localhost:8000` (configured in `vite.config.ts`)

### Auth
- JWT tokens stored in localStorage (`shiftlog.token.v1`, `shiftlog.refresh_token.v1`)
- `api.ts` attaches `Authorization: Bearer <token>` to all requests
- Login: `POST /auth/login` → `{ access_token, refresh_token }`
- Profile: `GET /auth/me` → `User` object

### Dashboard Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/plants/{id}/summary?date=` | KPI aggregation |
| GET | `/plants/{id}/shifts?date=` | Today's shifts with resolved names |
| GET | `/plants/{id}/teams/summary?date=` | Team performance summary |
| GET | `/plants/{id}/events?date=&limit=` | Recent operational events |
| GET | `/plants/{id}/incidents?status=` | Open investigations |
| GET | `/plants/{id}/assets/rollup?days=` | Asset downtime ranking |
| GET | `/plants/{id}/areas` | Area lookup |
| GET | `/plants/{id}/lines` | Line lookup |
| GET | `/plants/{id}/assets` | Asset lookup |
| GET | `/plants/{id}/teams` | Team lookup |

### Mobile Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Authenticate |
| GET | `/auth/me` | Current user |
| POST | `/shifts/start` | Start shift |
| POST | `/shifts/{id}/end` | End shift |
| POST | `/shifts/{id}/events` | Submit event |

---

## Continuous Learning

After completing each task:

1. **Verify** — Run `npm run build` and confirm it passes
2. **Commit** — Use conventional commit format
3. **Learn** — Update `.opencode/skills/learnings.md` with:
   - Any new patterns discovered
   - Decisions made and why
   - Gotchas or pitfalls encountered
   - Backend contract details (new endpoints, response shapes)
4. **Evolve** — If a new pattern emerges that should apply globally, update this skill file

The learnings file is append-only. Never delete entries — they form a chronological knowledge base of the project.
