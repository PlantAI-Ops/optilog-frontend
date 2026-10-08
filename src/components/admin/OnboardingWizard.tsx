import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PlantSetupForm,
  type AreaData,
  type LineData,
  type TeamData,
  hasTimeOverlap,
} from "./PlantSetupForm";
import { KeyTermsInput } from "./KeyTermsInput";
import {
  useCreatePlant,
  useUpdatePlant,
  useSeedPlant,
  useApplyWizardConfig,
} from "@/lib/admin-hooks";
import type { SeedPreset } from "@/lib/shift-log";
import { defaultShiftConfig } from "./PlantSetupForm";
import { useLocalStorageState } from "@/lib/useLocalStorage";
import { api, ApiError } from "@/lib/api";

const STEPS = ["Plant Details", "Areas", "Lines", "Teams", "Apply Setup", "Review"];

const STORAGE_KEY = "optilog.onboarding.v1";
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface WizardData {
  plantName: string;
  location: string;
  timezone: string;
  industry: string;
  key_terms: string[];
  language_notes: string;
  areas: AreaData[];
  lines: LineData[];
  teams: TeamData[];
  preset: SeedPreset;
  includeDemoData: boolean;
  lineShiftMode: "all" | "per_line";
  globalShiftType: string;
  customShiftName: string;
  setupMode: "config" | "preset" | "skip";
  setupApplied: boolean;
}

interface SavedWizardState {
  tenantId: string;
  step: number;
  data: WizardData;
  plantId: string;
  savedAt: number;
}

function readSavedState(): SavedWizardState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWizardState;
    if (!parsed.tenantId || !parsed.data || typeof parsed.step !== "number") return null;
    if (Date.now() - parsed.savedAt > STALE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function writeSavedState(state: SavedWizardState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage full or unavailable — fail silently
  }
}

function clearSavedState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}

function stepLabel(step: number): string {
  return STEPS[step] ?? `Step ${step + 1}`;
}

type SetupCheck = "applied" | "empty" | "partial";

// Ask the server whether this plant actually has its setup, instead of
// trusting the persisted setupApplied flag (stale localStorage can claim
// success while the plant was never configured).
async function checkPlantSetup(plantId: string): Promise<SetupCheck> {
  const [areas, teams] = await Promise.all([
    api.get<unknown[]>(`/assets/plants/${plantId}/areas`),
    api.get<unknown[]>(`/plants/${plantId}/teams`),
  ]);
  const hasAreas = areas.length > 0;
  const hasTeams = teams.length > 0;
  if (hasAreas && hasTeams) return "applied";
  if (!hasAreas && !hasTeams) return "empty";
  return "partial";
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function normalizeLines(lines: LineData[]): LineData[] {
  const seen = new Set<string>();
  const out: LineData[] = [];
  for (const line of lines) {
    const key = line.name.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: line.name, areaIndex: 0 });
  }
  return out.length > 0 ? out : [{ name: "Line-1", areaIndex: 0 }];
}

const EMPTY_DATA: WizardData = {
  plantName: "",
  location: "",
  timezone: "UTC",
  industry: "",
  key_terms: [],
  language_notes: "",
  areas: [{ name: "", description: "" }],
  lines: [{ name: "Line-1", areaIndex: 0 }],
  teams: [{ name: "Team A", shift_config: defaultShiftConfig("regular_day") }],
  preset: "minimal",
  includeDemoData: false,
  lineShiftMode: "all",
  globalShiftType: "regular_day",
  customShiftName: "",
  setupMode: "config",
  setupApplied: false,
};

export function OnboardingWizard({ tenantId }: { tenantId: string }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...EMPTY_DATA });
  const [plantId, setPlantId] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<Record<string, number> | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [stalePlant, setStalePlant] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [setupConfirmed, setSetupConfirmed] = useState(false);

  const [showResume, setShowResume] = useState(false);
  const [resumeInfo, setResumeInfo] = useState<{
    plantName: string;
    step: number;
  } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);

  const createPlant = useCreatePlant(tenantId);
  const updatePlant = useUpdatePlant(plantId ?? "", tenantId);
  const seedPlant = useSeedPlant(plantId ?? "", tenantId);
  const applyWizardConfig = useApplyWizardConfig(plantId ?? "", tenantId);

  const update = useCallback((patch: Partial<WizardData>) => {
    setData((d) => ({ ...d, ...patch }));
  }, []);

  // Save to localStorage (debounced)
  const scheduleSave = useCallback(
    (currentStep: number, currentData: WizardData, currentPlantId: string | null) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (currentStep === 0 && !currentPlantId) return;
        writeSavedState({
          tenantId,
          step: currentStep,
          data: currentData,
          plantId: currentPlantId ?? "",
          savedAt: Date.now(),
        });
      }, 500);
    },
    [tenantId],
  );

  // Save after state changes (only after hydration)
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    scheduleSave(step, data, plantId);
  }, [step, data, plantId, scheduleSave]);

  // Hydrate on mount
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;

    const saved = readSavedState();
    if (saved && saved.tenantId === tenantId && saved.step > 0) {
      setResumeInfo({ plantName: saved.data.plantName, step: saved.step });
      setShowResume(true);
    }
  }, [tenantId]);

  // Errors belong to the step that produced them
  useEffect(() => {
    setStepError(null);
  }, [step]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleResume = useCallback(() => {
    const saved = readSavedState();
    if (saved && saved.tenantId === tenantId) {
      setStep(saved.step);
      // Older drafts could hold setupMode "preset"/"skip" and per-area line
      // duplication — coerce both onto the current single-count config path.
      // Older drafts predate the vocabulary fields — spread the defaults
      // underneath so those inputs stay controlled.
      setData({
        ...EMPTY_DATA,
        ...saved.data,
        setupMode: "config",
        lines: normalizeLines(saved.data.lines),
      });
      setPlantId(saved.plantId || null);
    }
    setStepError(null);
    setShowResume(false);
    setResumeInfo(null);
  }, [tenantId]);

  const handleStartFresh = useCallback(() => {
    clearSavedState();
    setStep(0);
    setData({ ...EMPTY_DATA });
    // Keep an already-created plant: abandoning it here would orphan the record,
    // and the next Next at step 0 reuses it instead of creating a duplicate.
    setSeedResult(null);
    setSetupConfirmed(false);
    setStepError(null);
    setStalePlant(false);
    setShowResume(false);
    setResumeInfo(null);
  }, []);

  const handleNext = async () => {
    if (step === 0) {
      try {
        if (plantId) {
          // Already created — update in place so a return trip to step 0
          // never POSTs a second plant.
          await updatePlant.mutateAsync({
            name: data.plantName,
            location: data.location,
            timezone: data.timezone,
            industry: data.industry.trim(),
            key_terms: data.key_terms,
            language_notes: data.language_notes.trim(),
          });
        } else {
          const result = await createPlant.mutateAsync({
            name: data.plantName,
            location: data.location,
            timezone: data.timezone,
            industry: data.industry.trim(),
            key_terms: data.key_terms,
            language_notes: data.language_notes.trim(),
          });
          setPlantId(result.id);
        }
        setStalePlant(false);
        setStep(1);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setStalePlant(true);
          setStepError("The saved plant no longer exists. Create a new one to continue.");
        } else {
          setStepError(errorMessage(err, "Could not save plant details."));
        }
      }
    } else if (step === 4) {
      if (!plantId) {
        setStepError("No plant was created yet. Go back to step 1 and try again.");
        return;
      }
      if (data.setupApplied) {
        // Never trust the persisted flag alone: stale localStorage can claim
        // success while the plant has no areas or teams at all.
        setVerifying(true);
        let check: SetupCheck;
        try {
          check = await checkPlantSetup(plantId);
        } catch (err) {
          setStepError(errorMessage(err, "Could not verify the plant setup status."));
          return;
        } finally {
          setVerifying(false);
        }
        if (check === "applied") {
          setSetupConfirmed(true);
          setStep(5);
          return;
        }
        if (check === "partial") {
          setStepError(
            "Setup was only partially applied to this plant. Re-running setup would create duplicate areas, lines, or teams - start a fresh onboarding for a new plant instead.",
          );
          return;
        }
        // Flag was stale (plant is empty): fall through and apply for real.
        update({ setupApplied: false });
      }
      try {
        if (data.setupMode === "config") {
          const result = await applyWizardConfig.mutateAsync({
            areas: data.areas,
            lines: data.lines,
            teams: data.teams,
            globalShiftType: data.globalShiftType,
            customShiftName: data.customShiftName,
            globalShiftConfig:
              data.teams[0]?.shift_config ?? defaultShiftConfig(data.globalShiftType),
          });
          setSeedResult(result.created);
          setSetupConfirmed(true);
          update({ setupApplied: true });
        } else if (data.setupMode === "preset") {
          const result = await seedPlant.mutateAsync({
            preset: data.preset,
            include_demo_data: data.includeDemoData,
          });
          setSeedResult(result.created);
          setSetupConfirmed(true);
          update({ setupApplied: true });
        }
        // skip: no API call, just move to review
        setStep(5);
      } catch (err) {
        setStepError(
          errorMessage(err, "Setup could not be applied. Check the values and try again."),
        );
      }
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const handleComplete = () => {
    clearSavedState();
  };

  const canNext = () => {
    if (step === 0) return data.plantName.trim().length > 0;
    if (step === 2) return data.lines.length > 0 && data.lines.every((l) => l.name.trim());
    if (step === 3) {
      if (data.globalShiftType === "custom") {
        // Custom is teams-only — at least one team with its own config required.
        if (data.teams.length === 0) return false;
        for (let i = 0; i < data.teams.length; i++) {
          for (let j = i + 1; j < data.teams.length; j++) {
            const a = data.teams[i];
            const b = data.teams[j];
            if (a && b && hasTimeOverlap(a.shift_config, b.shift_config)) return false;
          }
        }
      } else {
        // Rotating/extended/regular: roster is optional — the backend generates
        // crew teams from the shift pattern when none are entered.
        const shifts = data.teams.map((t) => t.current_shift).filter((s): s is string => !!s);
        if (new Set(shifts).size !== shifts.length) return false;
      }
      return data.teams.every((t) => t.name.trim());
    }
    // Step 4: skip is always available, so always true
    if (step === 4) return true;
    return true;
  };

  const namedAreas = data.areas.filter((a) => a.name.trim()).length;
  const namedLines = data.lines.filter((l) => l.name.trim()).length;
  const namedTeams = data.teams.filter((t) => t.name.trim()).length;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Resume prompt */}
      {showResume && resumeInfo && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Unfinished Setup</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You have an unfinished setup for "{resumeInfo.plantName}" (step {resumeInfo.step + 1}:{" "}
            {stepLabel(resumeInfo.step)}).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleStartFresh}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
            >
              Start Fresh
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>
      <p className="mb-4 text-sm font-medium">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {/* Step content */}
      <div className="min-h-[300px]">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="plant-name">Plant name</Label>
              <Input
                id="plant-name"
                placeholder="e.g. Factory Alpha"
                value={data.plantName}
                onChange={(e) => update({ plantName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plant-location">Location</Label>
              <Input
                id="plant-location"
                placeholder="e.g. Austin, TX"
                value={data.location}
                onChange={(e) => update({ location: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="plant-timezone">Timezone</Label>
              <select
                id="plant-timezone"
                value={data.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Shanghai">Shanghai </option>
              </select>
            </div>
            <div>
              <Label htmlFor="plant-industry">Industry</Label>
              <Input
                id="plant-industry"
                maxLength={120}
                placeholder="e.g. Pulp & paper"
                value={data.industry}
                onChange={(e) => update({ industry: e.target.value })}
                className="mt-1"
              />
            </div>
            <KeyTermsInput
              id="plant-key-terms"
              value={data.key_terms}
              onChange={(key_terms) => update({ key_terms })}
            />
            <div>
              <Label htmlFor="plant-language-notes">Language notes</Label>
              <textarea
                id="plant-language-notes"
                maxLength={500}
                rows={3}
                placeholder="e.g. Operators mix Spanish and English; say machine names slowly."
                value={data.language_notes}
                onChange={(e) => update({ language_notes: e.target.value })}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}

        {step === 1 && plantId && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={2}
            lineShiftMode={data.lineShiftMode}
            setLineShiftMode={(lineShiftMode) => update({ lineShiftMode })}
            globalShiftType={data.globalShiftType}
            setGlobalShiftType={(globalShiftType) => update({ globalShiftType })}
            customShiftName={data.customShiftName}
            setCustomShiftName={(customShiftName) => update({ customShiftName })}
            tenantId={tenantId}
            plantId={plantId}
          />
        )}

        {step === 2 && plantId && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={3}
            lineShiftMode={data.lineShiftMode}
            setLineShiftMode={(lineShiftMode) => update({ lineShiftMode })}
            globalShiftType={data.globalShiftType}
            setGlobalShiftType={(globalShiftType) => update({ globalShiftType })}
            customShiftName={data.customShiftName}
            setCustomShiftName={(customShiftName) => update({ customShiftName })}
            tenantId={tenantId}
            plantId={plantId}
          />
        )}

        {step === 3 && plantId && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={4}
            lineShiftMode={data.lineShiftMode}
            setLineShiftMode={(lineShiftMode) => update({ lineShiftMode })}
            globalShiftType={data.globalShiftType}
            setGlobalShiftType={(globalShiftType) => update({ globalShiftType })}
            customShiftName={data.customShiftName}
            setCustomShiftName={(customShiftName) => update({ customShiftName })}
            tenantId={tenantId}
            plantId={plantId}
          />
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review what onboarding will create, then apply it:
            </p>

            {/* Summary of the wizard configuration */}
            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <p className="text-sm font-medium">What will be created:</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>{namedAreas} area(s)</li>
                <li>{namedLines} line(s)</li>
                <li>{namedTeams} team(s)</li>
                <li>Shift type: {data.globalShiftType.replace(/_/g, " ")}</li>
              </ul>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg border border-green-200 bg-green-50 p-4"
            >
              <p className="text-sm font-medium text-green-800">Plant created successfully!</p>
              <p className="mt-1 text-sm text-green-700">
                {data.plantName} is ready.
                {data.setupMode === "config" &&
                  setupConfirmed &&
                  " Your wizard configuration has been applied."}
                {data.setupMode === "preset" &&
                  setupConfirmed &&
                  ` Set up with the ${data.preset} preset.`}
                {data.setupMode === "skip" &&
                  " No data was seeded - run onboarding again whenever you want to configure the plant."}
              </p>
            </div>

            {/* Team summary with line assignments */}
            {data.setupMode === "config" && setupConfirmed && data.teams.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Teams &amp; Lines</p>
                <div className="mt-2 space-y-1.5">
                  {data.teams
                    .filter((t) => t.name.trim())
                    .map((team, i) => {
                      const assigned = team.assigned_line_indices ?? [];
                      const lineNames =
                        assigned.length === 0
                          ? "All lines"
                          : assigned
                              .map((li) => {
                                const line = data.lines[li];
                                if (!line) return null;
                                const areaName =
                                  data.areas[line.areaIndex]?.name || `Area ${line.areaIndex + 1}`;
                                return `${areaName} \u203A ${line.name || `Line ${li + 1}`}`;
                              })
                              .filter(Boolean)
                              .join(", ");
                      const shiftLabel = team.current_shift
                        ? ` — ${team.current_shift.charAt(0).toUpperCase() + team.current_shift.slice(1)}`
                        : "";
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{team.name}</span>
                          <span className="text-muted-foreground">{shiftLabel}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-muted-foreground">{lineNames}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {seedResult && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">What was created:</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {Object.entries(seedResult).map(([key, count]) => (
                    <div key={key} className="rounded-lg bg-secondary p-2 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {stepError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p>{stepError}</p>
          {stalePlant && (
            <button
              type="button"
              onClick={() => {
                setPlantId(null);
                setStalePlant(false);
                setStepError(null);
              }}
              className="mt-2 rounded-lg border border-destructive/40 px-3 py-1 text-xs font-medium hover:bg-destructive/10"
            >
              Create new plant instead
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0 || data.setupApplied}
          title={data.setupApplied ? "Setup has been applied and cannot be edited here" : undefined}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={
              !canNext() ||
              verifying ||
              createPlant.isPending ||
              updatePlant.isPending ||
              seedPlant.isPending ||
              applyWizardConfig.isPending
            }
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {(verifying ||
              createPlant.isPending ||
              updatePlant.isPending ||
              seedPlant.isPending ||
              applyWizardConfig.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === 4
              ? data.setupMode === "config"
                ? "Apply Setup"
                : data.setupMode === "skip"
                  ? "Skip"
                  : "Seed Plant"
              : "Next"}
          </button>
        ) : (
          <a
            href={`/console/admin/${tenantId}`}
            onClick={handleComplete}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </a>
        )}
      </div>
    </div>
  );
}
