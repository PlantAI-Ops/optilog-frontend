# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: shift supervisors and plant managers.** They live in the Operations Console — reviewing today's events across teams/shifts/lines, editing or correcting entries, carrying unresolved issues forward, running root-cause analyses, and approving shift reports.
- **Secondary: production operators.** They capture what happens during a shift by voice from a phone-sized flow (login → start shift → record → confirm → timeline → end-shift handover). Their capture feeds every console view.
- **Tertiary: plant/tenant administrators.** They provision the product — tenants, plants, the area/line/team/shift onboarding wizard, seed data, and email invitations.

Roles in the system: `operator`, `technician`, `supervisor`, `shift_manager`, `plant_manager`, `integration_admin`, `system_admin`.

## Product Purpose

OptiLog records what actually happened on a production floor during a shift and turns it into a structured operational record. It exists because shift knowledge is otherwise lost — in heads, in paper logs, in chat messages — and the next shift inherits problems nobody wrote down.

Success looks like: every meaningful event of a shift captured with minimal friction, nothing lost to a dropped connection or app kill, unresolved issues handed to the next shift explicitly, and supervisors able to review, correct, and act on a trustworthy timeline.

## Positioning

Three mechanisms combined, which a neighboring product could not truthfully copy all at once:

1. **Voice-first, offline capture** — one-tap spoken event logging that survives intermittent connectivity, queues locally, and syncs silently when the network returns.
2. **An auditable event record** — observation, reported cause, and verified cause stay structurally distinct fields; collapsing them into one description destroys the audit value and is forbidden in the UI.
3. **An operations intelligence layer** — that event record is the single substrate under shifts, teams, assets, RCA, maintenance, and integrations, so the console's numbers trace back to something an operator actually said.

Positioning line already used in the product: "Operational Record & Intelligence Layer"; the capture flow is described as "Voice shift logging for production floors".

## Operating Context

- **Factory floor conditions** for operators: noisy environment, dirty or gloved hands, bright sunlight/glare, poor or intermittent connectivity, short attention windows mid-task, and varying tech literacy. Controls must be large, reachable in 1–2 taps, and legible in glare.
- **Plant structure** is the organizing grammar: tenants → plants → areas → lines → assets → teams, with shift patterns (morning/afternoon/night; `regular_day`, `extended_day`, `night`, rotating `2-2-2-2` / `3-3-3-3`, `extended_rotating`), per-line shift modes, and team rotation.
- **Shift rhythm**: start of shift shows current shift, team, selected line, and carryover issues from the previous shift; end of shift produces a summary and handover note.
- **Multi-tenant B2B SaaS**: tenants carry status (`trial` / `active` / `suspended` / `cancelled`), `trial_ends_at`, `max_users`, `max_plants`, and feature flags (`rca_enabled`, `integrations_enabled`, `analytics_enabled`, `max_events_per_month`). Users arrive through token-based email invitations (SendGrid), not self-signup.
- **Deployment/stack context**: TanStack Start + React 19 + Tailwind 4 SPA-style frontend (this repo), talking to a FastAPI + PostgreSQL backend at `VITE_API_BASE_URL` (`/api/v1`), JWT access/refresh auth, hosted/edited through Lovable.

## Capabilities and Constraints

**Shipped surfaces (routes in this repo):**

- **Operator capture flow** (`/`, `/timeline`, `/end-shift`, `/report`): login, start shift with line selection and carryover issues, one-tap voice recording with transcription, a compact confirm/edit/clarify card, chronological shift timeline with expandable entries and pending-sync badges, end-of-shift summary/handover, shift report view.
- **Operations Console** (`/console/*`): plant dashboard (achievement, downtime, active issues, RCA pending), operational event stream, shift explorer, calendar, team performance, planned maintenance, RCA workspace, integrations hub ("OptiLog Connect"), canonical data model reference.
- **Admin console** (`/console/admin/*`): tenant list/create, tenant detail with users and plants, 6-step plant onboarding wizard (plant details → areas → lines → teams → seed/skip/setup → review, resumable via `localStorage` key `optilog.onboarding.v1` with 24h TTL), and user invitations (form or CSV upload).
- **Invitation acceptance** (`/invite/:token`): public, no auth; fetch info, accept with name + password, then store tokens.

**Constraints and rules future work must preserve:**

- Offline-first capture is a hard requirement: events persist locally before any network call, carry a `pending`/`synced` state, retry silently, and must never be lost to a dropped connection, app kill, or restart.
- Observation / reported cause / verified cause must stay visibly distinct, even in the compact confirmation card.
- Authorization is enforced by the backend; the UI must not expose actions a role cannot perform.
- The frontend does not own the event model but must render and lightly edit it: `event_type`, `asset`, `subsystem`, `timestamp`, `duration_minutes`, `observation`, `reported_cause`, `verified_cause`, `action_taken`, `status`, `source`, `confidence`.
- The app talks only to the backend — no direct machine/PLC/SCADA interaction.
- This repo is a **web** product; the Flutter mobile PRD in `README.md` is legacy context, not a second codebase. Its floor-condition requirements still describe how operators actually use the product.

**Open decisions (recorded, not invented):**

- Whether multi-language voice input ships (flagged as V2 in the legacy PRD) — undecided.
- Whether a native mobile app accompanies the web app — undecided; the web app is the product today.
- Report template configuration stays an admin/backend concern; the frontend only triggers and displays reports.

## Brand Commitments

- Name: **OptiLog**, with logo asset at `public/optilog-logo.svg`.
- Existing positioning phrases: "Operational Record & Intelligence Layer", "Voice shift logging for production floors".
- Sub-product name already in use: **OptiLog Connect** (integrations hub).
- Voice observed in shipped copy: direct, operational, plain-spoken, no marketing flourish ("Sign in to continue", "Start Logging", "Shift summary", "No carryover issues from previous shift").
- No binding visual constraint (palette, typography, imagery) has been declared by the user.

## Evidence on Hand

- `README.md` — the original Shift-Log mobile PRD: purpose, floor conditions, core operator journey, event data model rules, offline requirements, supervisor requirements, MVP scope. Legacy as to platform; authoritative as to floor context and capture rules.
- `notes/FRONTEND_NOTES.md` — full API endpoint tables, TypeScript types, React Query hook patterns, error-code handling, and a dated changelog (source of truth for frontend/backend sync).
- `notes/BACKEND_NOTES.md` — onboarding wizard flow, step-by-step payloads, validation rules, localStorage resume shape.
- `notes/ADMIN_API_DOCUMENTATION.md`, `notes/SHIFT_CONFIG_BACKEND_GUIDE.md` — admin endpoints and shift-configuration backend behavior.
- `src/routes/**`, `src/components/**`, `src/lib/**` — the shipped interface itself, the incumbent implementation of every claim above.
- The login form starts empty — no credentials are pre-filled.
- **Absences that future work must not fabricate:** no customer logos, testimonials, case studies, press, pricing, or published benchmarks exist in this repo. No analytics/charts claims beyond what the dashboard actually renders.

## Product Principles

1. **The record must never be lost.** Local persistence first, silent sync second; a connection drop, app kill, or restart does not delete what an operator said.
2. **One event, one recording, one action.** The floor flow nudges toward single-event captures confirmed in one tap rather than forms, menus, or multi-step wizards.
3. **Preserve the audit distinction.** Observation, reported cause, and verified cause are separate facts and stay separate in every surface that shows them.
4. **One substrate under every surface.** Operator capture, console analysis, and admin provisioning all read from and write to the same event/shift/team model — no view invents its own truth.
5. **Roles gate actions visibly.** The UI shows only what a role can do; the backend remains the enforcement point.

## Accessibility & Inclusion

- Large tap targets and high-contrast legibility are core requirements for the capture flow, treated as first-class (gloved hands, sunlight glare, short attention windows), not add-ons.
- Users may not be highly tech-literate; confirmations are minimal and status indicators are unambiguous.
- UI strings are expected to be externalizable/localizable from day one (multi-language voice input itself is undecided/V2).
- **Standard: WCAG 2.2 Level AA.** Future audits, polish, and new surfaces are held to WCAG 2.2 AA. The floor-condition requirements above are the floor-specific interpretation of it (e.g. target sizes, contrast in glare) and are not relaxed by it.
