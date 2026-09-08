import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SeedPresetSelector } from "./SeedPresetSelector";
import { PlantSetupForm, type AreaData, type LineData, type TeamData } from "./PlantSetupForm";
import { useCreatePlant, useSeedPlant } from "@/lib/admin-hooks";
import type { SeedPreset } from "@/lib/shift-log";
import { defaultShiftConfig } from "./PlantSetupForm";

const STEPS = ["Plant Details", "Areas", "Lines", "Teams", "Seed Data", "Review"];

interface WizardData {
  plantName: string;
  location: string;
  timezone: string;
  areas: AreaData[];
  lines: LineData[];
  teams: TeamData[];
  preset: SeedPreset;
  includeDemoData: boolean;
}

export function OnboardingWizard({ tenantId }: { tenantId: string }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    plantName: "",
    location: "",
    timezone: "UTC",
    areas: [{ name: "", description: "" }],
    lines: [],
    teams: [{ name: "", shift_config: defaultShiftConfig("regular_day") }],
    preset: "minimal",
    includeDemoData: false,
  });
  const [plantId, setPlantId] = useState<string | null>(null);
  const [seedResult, setSeedResult] = useState<Record<string, number> | null>(null);

  const createPlant = useCreatePlant(tenantId);
  const seedPlant = useSeedPlant(plantId ?? "", tenantId);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  const handleNext = async () => {
    if (step === 0) {
      // Step 1: Create plant
      try {
        const result = await createPlant.mutateAsync({
          name: data.plantName,
          location: data.location,
          timezone: data.timezone,
        });
        setPlantId(result.id);
        setStep(1);
      } catch {
        // Error handled by mutation
      }
    } else if (step === 4) {
      // Step 5: Seed plant
      if (!plantId) return;
      try {
        const result = await seedPlant.mutateAsync({
          preset: data.preset,
          include_demo_data: data.includeDemoData,
        });
        setSeedResult(result.created);
        setStep(5);
      } catch {
        // Error handled by mutation
      }
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  };

  const canNext = () => {
    if (step === 0) return data.plantName.trim().length > 0;
    if (step === 2) return data.lines.length > 0 && data.lines.every((l) => l.name.trim());
    if (step === 3) return data.teams.length > 0 && data.teams.every((t) => t.name.trim());
    return true;
  };

  return (
    <div className="mx-auto max-w-2xl">
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
                <option value="Asia/Shanghai">Shanghai</option>
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={2}
          />
        )}

        {step === 2 && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={3}
          />
        )}

        {step === 3 && (
          <PlantSetupForm
            areas={data.areas}
            setAreas={(areas) => update({ areas })}
            lines={data.lines}
            setLines={(lines) => update({ lines })}
            teams={data.teams}
            setTeams={(teams) => update({ teams })}
            step={4}
          />
        )}

        {step === 4 && (
          <div className="space-y-4">
            <SeedPresetSelector value={data.preset} onChange={(preset) => update({ preset })} />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.includeDemoData}
                onChange={(e) => update({ includeDemoData: e.target.checked })}
                className="accent-primary"
              />
              Include demo data (historical shifts, events, recordings)
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">Plant created successfully!</p>
              <p className="mt-1 text-sm text-green-700">
                {data.plantName} has been set up with the {data.preset} preset.
              </p>
            </div>
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
      {(createPlant.isError || seedPlant.isError) && (
        <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {createPlant.error?.message || seedPlant.error?.message || "An error occurred"}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext() || createPlant.isPending || seedPlant.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {(createPlant.isPending || seedPlant.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {step === 4 ? "Seed Plant" : "Next"}
          </button>
        ) : (
          <a
            href={`/console/admin/${tenantId}`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </a>
        )}
      </div>
    </div>
  );
}
