# optilog-frontend

Shift-Log — Frontend (Mobile App) PRD

Product: Shift-Log
Component: Mobile Application
Platform: Flutter (Android + iOS, single codebase)
Primary users: Production operators
Secondary users: Shift supervisors
Companion doc: BACKEND_PRD.md

This document defines the requirements for the mobile frontend only. It assumes the backend (FastAPI + PostgreSQL) exposes the APIs described in the Backend PRD, and focuses on what the app must do, how it should behave offline, and the interaction model that makes voice-first shift logging fast enough to actually get used on a factory floor.

1. Purpose

Give operators a way to capture what happens during a shift by speaking, with almost no typing, no menus to dig through, and no risk of losing data when the network drops. The app is the single surface operators touch during a shift; everything else (structuring, reporting) happens behind it.

2. Design Constraints — Who Is Actually Using This

The UI must be designed for the real conditions of a production floor, not an office:

Dirty or gloved hands

Noisy environment (voice input must be robust, screen input must be minimal)

Poor or intermittent connectivity

Bright sunlight / glare on screen

Short attention windows — operators are mid-task, not sitting at a desk

Users may not be highly tech-literate

Design accordingly:

AvoidPreferDense tablesLarge, tappable controlsTiny buttonsOne-action recording (tap once, speak)Long formsClear status indicatorsTypingMinimal confirmation stepsDeep/complex navigationEverything reachable in 1–2 taps

3. Core User Journey (Operator)

codeCode

Open app → Log in → Start Shift → [Record events throughout shift] → End Shift → (Supervisor generates report)

3.1 Start of Shift

On login, show a simple shift-start screen:

codeCode

Good morning.

Shift: Morning
Production area: Packaging Line 2
Previous shift: 3 unresolved issues

[ Start Shift ]

Pull "unresolved issues from previous shift" from the backend so the operator starts with context.

One tap to begin — no setup wizard.

3.2 Home / Recording Screen

This is the screen the operator will look at 90% of the time. It must be close to a single button.

codeCode

┌─────────────────────────┐
│ SHIFT-LOG                │
│                           │
│ Shift: Morning            │
│ Line: Packaging 2         │
│                           │
│        🎙 RECORD          │
│                           │
│  7 events recorded        │
│  2 unresolved              │
│                           │
│ [ View Shift ]             │
└─────────────────────────┘

Requirements:

The RECORD button is the dominant visual element — large, thumb-reachable, unambiguous.

Tap once to start recording, tap again (or release, if push-to-talk) to stop. Support both interaction models in testing and pick whichever proves faster/less error-prone.

A running counter of events recorded and unresolved issues gives the operator situational awareness without navigating away.

"View Shift" opens the timeline (see §3.5).

3.3 Recording Flow

Operator taps RECORD.

Visual + haptic feedback confirms recording started (waveform or pulse animation — avoid a static "recording" text label alone, since it's easy to miss in bright light).

Operator speaks naturally, e.g.:

"Line 2 stopped around 10:15. The conveyor was jammed. Maintenance came and fixed it after about twenty minutes."

Operator taps to stop (or silence auto-detection stops it — configurable).

Audio is saved locally immediately, before any network call is attempted.

App sends audio to backend for transcription + structuring (or queues it if offline — see §5).

3.4 Confirmation Screen

Once the backend (or local queue) returns a structured event, show a compact confirmation card — never the raw JSON, never a long form.

codeCode

I captured:

Line 2 — Conveyor jam
Approx. 10:15
~20 minutes
Maintenance resolved it

[ Confirm ]   [ Edit ]

Confirm commits the event to the shift timeline in one tap.

Edit opens a lightweight editable version of the same card (structured fields, not free text re-entry) — the operator should never have to retype the whole event to fix one field.

If the AI needs clarification (missing duration, cause, etc.), the app should present it as a short, single-question prompt, not a form:

codeCode

How long was the stoppage?
[ mic ]  or  [ type a number ]

Ask at most one follow-up at a time. Never block the operator with more than one outstanding clarification.

3.5 Shift Timeline View

A scrollable, chronological list of the shift's events, read-only for operators (editable for supervisors — see §7).

codeCode

06:02  Shift started
07:14  Material shortage — Line 2 — Resolved
08:41  Quality observation — SKU-204 — Under review
10:15  Conveyor jam — Line 2 — 20 min — Resolved
12:27  Abnormal motor noise — Line 3 — Unresolved

Each entry shows: time, event type, asset, short status.

Tapping an entry expands it to show the original transcript, structured fields, and (if applicable) the audio playback — this is the audit trail and should always be reachable, not hidden behind extra navigation.

Visually distinguish unresolved items (e.g. color or icon) so operators and supervisors can scan quickly.

3.6 End of Shift

A clear "End Shift" action (supervisor-gated, or operator-initiated with supervisor approval — configurable per plant).

On end, show a short summary: total events, resolved/unresolved counts, and a prompt to hand off ("Anything the next shift needs to know?") — this becomes the handover note.

Report generation itself is a backend operation triggered from here or from the supervisor's view (Backend PRD §Reports); the frontend just needs to trigger it and display/share the resulting PDF.

4. Event Data Model (Frontend Contract)

The frontend doesn't own this model, but it needs to render and edit it. Per the Backend PRD, each event includes:

codeCode

event_type, asset, subsystem, timestamp, duration_minutes,
observation, reported_cause, verified_cause, action_taken,
status, source, confidence

Critical UI rule: the app must visually keep observation, reported cause, and verified cause distinct. These should never be merged into a single free-text description in the UI — collapsing them destroys the audit value described in the Backend PRD (§10, §24). Use separate labeled fields even in the compact confirmation card if more than one is present.

5. Offline-First Behavior

This is a hard requirement, not a nice-to-have.

codeCode

Record → Save locally → Sync when available

All recordings, transcripts (once available), and structured events are written to a local database (e.g. SQLite via Flutter's sqflite or drift) immediately, before any network call.

If the device is offline when recording happens:

Store the raw audio locally.

Queue it for transcription/structuring once connectivity returns (this may happen on-device with a lightweight fallback, or purely deferred — see Backend PRD for split of responsibility).

The operator should still see the event appear on their local timeline immediately, marked as "pending sync."

Sync should be automatic and silent when connectivity returns — no user action required.

No event should ever be lost due to a dropped connection, app kill, or device restart. Local persistence must survive all three.

Show a simple, non-alarming sync status indicator (e.g. small badge: "3 pending sync") rather than blocking the UI or throwing errors at the operator.

6. Voice & Audio Requirements

Support push-to-talk and/or tap-to-toggle recording (test both).

Must function reasonably in noisy industrial environments — this is largely a backend/STT concern, but the frontend should support recording at a quality level (sample rate, noise gate) sufient for that.

Must handle industrial terminology gracefully — if the transcript looks obviously garbled, allow easy re-record rather than forcing a manual correction of a bad transcript.

Recordings should be short by design (single-event, not a whole-shift monologue) — the UI should nudge toward "one event per recording" through the interaction model itself (record → confirm → repeat), not through instructions.

7. Supervisor-Specific Frontend Requirements

Supervisors use the same app with elevated permissions:

Start/end shifts on behalf of the team.

Review the full event timeline, including entries logged by any operator on their shift.

Edit or correct any event (structured field editing, same lightweight pattern as §3.4).

Add events manually (typed or voice) — e.g. for something they observed directly.

View unresolved issues across the shift, with the ability to flag/carry them forward.

Trigger report generation and review the generated report before approving/sharing it.

Approve the report (single action; approval status should be visible and unambiguous).

The supervisor view can reuse the operator's core screens with an added "all events" scope and edit affordances, rather than being a separate app experience — keep footprint and maintenance burden small.

8. Authentication (Frontend Responsibilities)

Username/password login screen, storing a JWT securely on-device (e.g. flutter_secure_storage).

Session should persist across app restarts (don't force re-login every shift).

Respect role returned by backend (operator / supervisor / manager / administrator) to show/hide the supervisor-only actions in §7. The frontend must not assume trust — enforcement is a backend concern, but the UI shouldn't expose actions a role can't perform.

9. Non-Functional Requirements

Startup time: app should be usable (able to start recording) within a few seconds of opening — no heavy splash/onboarding on every launch.

Battery/CPU: background sync and local storage writes should be efficient enough for a full shift of use without materially draining battery.

Accessibility: large tap targets and high-contrast UI (per §2) double as general usability improvements and should be treated as core requirements, not accessibility add-ons.

Localization-ready: even though multi-language voice interaction is a V2 item (Backend PRD §27), the UI strings should be externalized/localizable from day one to avoid rework later.

10. Explicit Non-Goals for the Frontend

No dashboards, analytics, or charts in the MVP — that's a V2+ concern and belongs elsewhere if it happens at all.

No direct machine/PLC/SCADA interaction — the app talks to the backend only.

No offline AI structuring in the MVP — offline mode stores raw audio and defers structuring until sync (unless the community wants to contribute an on-device fallback later).

No complex template editing in the app — report template configuration is an admin/backend concern (see Backend PRD).

11. MVP Scope (Frontend)

Must have

Login (JWT)

Start/End shift screen

Voice recording (tap or push-to-talk)

Confirmation card (Confirm / Edit)

Shift timeline (view + expand entry)

Manual event entry/edit (structured fields)

Local offline storage + background sync

Report view/share (PDF, generated by backend)

Supervisor: review/edit/approve

V1.1

Photo attachment to events

QR asset scanning to auto-fill asset field

Configurable event category picker (plant-defined categories from backend)

V2

Multi-language voice input

Richer offline structuring

Push notifications for unresolved issues / maintenance alerts

12. Open-Source Notes

This project is being open-sourced under the repository plantai-shift-log, with the mobile app living under mobile/. Contributors are especially welcome on:

Flutter offline-sync robustness (edge cases: app killed mid-recording, storage full, clock drift)

Voice UX refinement (push-to-talk vs. toggle, noise handling, re-record flow)

Accessibility and glove-friendly interaction patterns

Localization scaffolding

Please see the root README.md and docs/ for architecture context, and open an issue before starting large changes so effort isn't duplicated.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6967efdc-2bb3-4407-9281-df13a034d2ad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
