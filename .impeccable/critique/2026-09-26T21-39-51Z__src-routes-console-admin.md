---
target: console/admin
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\MY PC\\Documents\\GitHub\\optilog-frontend\\src\\routes\\console\\admin"
timestamp: 2026-09-26T21-39-51Z
slug: src-routes-console-admin
closed: true
---
# Critique: OptiLog tenant-admin console (`src/routes/console/admin`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Revoke/delete failures produce zero feedback; no `aria-live` anywhere; no retry |
| 2 | Match System / Real World | 3 | Strong domain language, but user-facing copy says "send … to the **backend**" (`OnboardingWizard.tsx:428`) |
| 3 | User Control and Freedom | 2 | Create-tenant modal has no Esc/backdrop dismiss; Back to step 0 re-creates a duplicate plant |
| 4 | Consistency and Standards | 1 | Zero `Button`/`Dialog` imports in any admin route — every control hand-rolled at 28px vs the 36px spec |
| 5 | Error Prevention | 1 | CSV rows without `@` vanish uncounted; disabled Next with no reason; partial invites reported as total success |
| 6 | Recognition Rather Than Recall | 3 | Resume prompt and inline invite panel are good; plant name never restated after step 0 |
| 7 | Flexibility and Efficiency | 2 | CSV preview + 24h resume exist; no Esc, no Enter-to-submit, inert step dots, no search/sort/resend |
| 8 | Aesthetic and Minimalist Design | 2 | Shell is disciplined; admin pages add pastel stickers, a 7-card role wall, `text-[10px]` cells |
| 9 | Error Recovery | 1 | Raw `{error.message}` surfaced verbatim; delete/revoke errors invisible; no field-level errors |
| 10 | Help and Documentation | 2 | Good micro-hints; zero help at the hard decisions (what is seeding, why is Next dead) |
| **Total** | | **19/40** | **Poor — major UX overhaul required** |

## Design Specificity Verdict

**Partially authored — the wizard is OptiLog; everything around it is category-interchangeable.**

**LLM assessment:** The 6-step wizard models real plant grammar (`STEPS`, areas-to-lines, `assigned_line_indices`, `SHIFT_TYPES` with "4-team, 2-day block cycle", `CUSTOM_SHIFT_NAMES` = Continental/DuPont/4-3/5-2/Southern). The 14-day `RotatingPreview` M/A/N strip (`PlantSetupForm.tsx:169-240`) is the best-designed object in the admin area and could not be transplanted to another product. Trial state is real (`trial_ends_at` countdown, `max_users`/`max_plants` caps).

Against that: `TrialStatusBadge.tsx:3-8` is Tailwind default `blue/green/yellow/red-100` — a chip that belongs equally in Stripe, Jira, or a CRM, and a direct breach of DESIGN.md's OKLCH-only and Signal-Only rules. Success blocks are Bootstrap-era `bg-green-50 border-green-200` (`invite.tsx:50-52`, `OnboardingWizard.tsx:505`). The tenant list (`index.tsx:61-97`) is a generic card grid with no reference to lines, shifts, or events — and `StatCard` (`ConsoleShell.tsx:153-179`) exists but is never used by any admin page.

**Verdict:** one deeply authored surface wrapped in three generic ones, all styled with off-system color literals. A competitor could clone the tenant list and invite screens unchanged; they could not clone the wizard.

**Deterministic scan:** 16 findings, all one rule — `design-system-font-size` (advisory). `PlantSetupForm.tsx` x15 (10px at lines 205, 212, 219, 224, 454, 531, 593, 618, 643, 840, 918, 929, 941, 944, 947), `ConsoleShell.tsx:183` (11px). All other scanned files clean. Detector caught breadth the review missed (only 205/219 were named). Detector missed the off-token pastel color and hand-rolled control sizes (it only checks font size against the type ramp), so the visual-system issue stands on LLM evidence alone. No false positives.

**Visual overlays:** browser automation not exposed in this session; overlay skipped; no user-visible overlay exists. Fallback signal: CLI detector only.

## Overall Impression

The wizard proves the team can build genuinely product-specific software — conflict-aware shift validation, honest CSV previews, and a resume flow most teams never ship. The surrounding console throws that away: hand-rolled controls, default-Tailwind pastels, and an error model that reports failure as silence or as success. The single biggest opportunity is making outcomes honest — the system currently congratulates admins for invites that did not send.

## What's Working

1. **Shift-work domain modelling** (`PlantSetupForm.tsx:99-141, 169-240`) — overnight range normalization, cross-team overlap blocking, duplicate-shift detection that disables already-taken options, and a 14-day rotating preview.
2. **Invitation input handling** (`UserInviteForm.tsx:53-58, 104-123`) — live comma/newline parsing, valid emails as chips, invalid struck through, a self-describing CTA, plus a real CSV preview capped at 25 rows.
3. **State recovery, built not bolted on** (`OnboardingWizard.tsx:45-76, 120-182`) — debounced saves, 24h TTL, tenant scoping, corrupted-payload handling, and a resume prompt that names the plant and step.

## Priority Issues

**[P0] Keyboard and screen-reader users cannot complete the CSV invite path; core controls have no names**
- What: File input is `className="hidden"` (`CsvInviteUpload.tsx:156-163`) so CSV upload needs a pointer. Icon-only buttons with no accessible name: invite revoke (`$tenantId/index.tsx:380-387`), modal close X (`index.tsx:105-111`), CSV clear X. Create-tenant modal (`index.tsx:100-190`) has no `role="dialog"`, no focus trap, no Escape. Group labels have no `htmlFor`. Nothing carries `role="status"`/`aria-live`.
- Why it matters: PRODUCT.md commits to WCAG 2.2 AA. Bulk invite is the primary admin task and the only door into the product — unreachable by keyboard.
- Fix: Visually-hidden-but-focusable input; `aria-label` on every icon-only button; adopt unused `Dialog`/`AlertDialog` primitives; associate group labels; add `role="status"`/`role="alert"` to progress, success, error regions.
- Suggested command: `$impeccable audit`

**[P0] The wizard silently creates duplicate plants and re-runs seeding**
- What: `handleNext` at `step === 0` unconditionally POSTs a plant (`OnboardingWizard.tsx:184-196`); Back still works, so Back then Next POSTs a second plant and orphans the first. Returning to step 4 and pressing Next re-invokes `seedPlant`/`applyWizardConfig` (197-220).
- Why it matters: Backwards navigation is normal wizard behaviour. The exit path destroys data with no warning.
- Fix: Make step 0 read-only once `plantId` exists (or switch Next to an update mutation); gate Back after commit; make the seed step one-way or idempotent.
- Suggested command: `$impeccable harden`

**[P1] The system lies about outcomes at the moments that matter most**
- What: `invite.tsx:97-107` shows "Invitations sent!" whenever any invite succeeded, discarding failures. `parseCsvEmails`/`parseEmails` silently drop rows without `@` (`CsvInviteUpload.tsx:28-35`). `useDeletePlant`/`useRevokeInvitation` have no `onError` and nothing reads their error state. Query errors render raw `{error.message}` with no retry (`index.tsx:81-84`).
- Why it matters: Invites are the only access path. An admin who believes 20 went out when 6 failed discovers it as support tickets.
- Fix: Success only on `every(ok)`, otherwise a "14 sent, 6 failed" summary with Retry; count dropped rows as invalid with a reason; `onError` + toast for delete/revoke; retry buttons; plain-language API error copy.
- Suggested command: `$impeccable clarify`

**[P1] The admin area breaks the stated visual system**
- What: Off-token color throughout — `TrialStatusBadge.tsx:3-8`, `invite.tsx:50-52`, `OnboardingWizard.tsx:505`, `PlantSetupForm.tsx:672/706/726`, `:178-183`. Uppercase Micro-Label rule broken at every form; Areas/Lines/Teams use `placeholder` as the only label (`PlantSetupForm.tsx:1017-1038`). Controls hand-rolled at `text-xs`/28px vs the 36px shadcn spec.
- Why it matters: The amber/steel/1px system is the product's only identity; this area reads as a Bootstrap panel bolted onto it.
- Fix: Map statuses to `--success`/`--warning`/`--destructive` with `bg-success/10 border-success/40`; restore uppercase micro-labels above every control; standardize on `h-9 px-4 text-sm rounded-md`.
- Suggested command: `$impeccable adapt`

**[P2] The wizard promises guidance it does not give, and "Review" does not review**
- What: Step 5 is labelled "Review" but renders a post-commit success banner (`OnboardingWizard.tsx:17, 503-513`). Step 4 says "from the wizard to the **backend**" (428). `canNext()` disables Next with no message (230-255, 587).
- Why it matters: A first-timer cannot tell whether they broke something or how to revive the dead button. Heuristics 5 and 10 both fail here.
- Fix: Rename step 5 to "Finish"; add a true read-only review at step 4 with explicit "Apply setup"; replace "backend" with consequence copy; render an inline `role="alert"` reason beside disabled Next.
- Suggested command: `$impeccable onboard`

## Persona Red Flags

**Alex (power user)** — Step dots are `div`s, not buttons (`OnboardingWizard.tsx:287-304`); Back disabled at step 0 so a wrong plant name is unfixable mid-flow; Back to step 0 silently duplicates a plant; no Escape on the modal; `PlantEditForm` is a `div` so Enter does nothing (`$tenantId/index.tsx:61-117`); no search/sort/filter/bulk; no resend, only unconfirmed revoke; raw anchor full reloads (`route.tsx:26-31`, `OnboardingWizard.tsx:602`); "Batch name" collected and discarded.

**Sam (accessibility)** — CSV upload impossible without a mouse; unnamed Trash2 revoke button; non-modal modal; radio groups of 7 with no accessible group name; selection by ring/background only; progress bar with no `role="progressbar"`; shift conflicts as `border-red-500` alone; six anonymous step circles with no ordered list and identical done/current styling.

**Jordan (first-timer)** — "backend" and "Seed Data" at the point of decision; "Rotating 2-2-2-2 · DuPont/Southern" with no inline definition; dead Next button explained only by `opacity-50`; invisible commit at step 0; "Review" does not review; Done is a page reload with no next step.

**Nadia, Tenant Administrator** (project-specific, from PRODUCT.md) — Cannot edit anything she creates: `useUpdateTenant`/`useDeleteTenant` (`admin-hooks.ts:69-96`) are imported by nothing, so no contact-email correction, trial extension, status change, `max_users` bump, or feature flags. Caps are read-only display. `trial_days`/`status` accepted by the API but exposed by no form. Partial CSV failures hide behind "Invitations sent!". No resend and no role edit — the only correction path destroys the sole access path.

## Minor Observations

- `route.tsx:25-32` renders "Back to Console" outside `ConsoleShell` — detached chrome above the rail.
- Heading inversion: shell h1 is `text-lg`, admin section heads are `text-sm` while their card titles are `text-base`.
- `daysLeft` computed twice, independently, in `TenantCard.tsx:6-9` and `TrialStatusBadge.tsx:24-27`.
- `deletePlant.isPending` disables delete on every `PlantCard` (`$tenantId/index.tsx:350-351`).
- Empty states are unstyled grey text; no dashed panel in the admin area.
- Loading is a bare Loader2 with no skeleton.
- Modal uses `bg-background` rather than an elevated surface; scrim `bg-black/50` vs specified `bg-black/80`.
- A `plant_manager` without `tenant_id` hitting `/console/admin` gets a permanent blank screen (`index.tsx:42-44`).
- `StatCard`/`SourceBadge` are never used by any admin page.

## Questions to Consider

1. Why does the "Review" step come after the commit, in a product whose principle is "the record must never be lost"?
2. Is an admin console that can create but never edit a tenant actually shipped — what is the recovery path for a typo in `contact_email`?
3. If invites are the only door in, what is the honest failure budget for a partial send?
4. Can the amber rarity rule survive the wizard, or should step indicators be neutral chrome with amber reserved for "Next" alone?
5. Who owns the pastel chips — is the admin console inside the design system, or tolerated by it?
