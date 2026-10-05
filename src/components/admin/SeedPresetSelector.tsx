import type { SeedPreset } from "@/lib/shift-log";

interface PresetOption {
  value: SeedPreset;
  label: string;
  description: string;
  entities: string[];
}

const PRESETS: PresetOption[] = [
  {
    value: "minimal",
    label: "Minimal",
    description: "Basic setup with areas, lines, teams, and an admin user.",
    entities: ["3-5 areas", "2-4 lines per area", "2-4 teams", "1 admin user"],
  },
  {
    value: "standard",
    label: "Standard",
    description: "Includes assets and operator/supervisor users.",
    entities: ["4 areas", "3 lines per area", "4 assets per line", "3 teams", "3 users"],
  },
  {
    value: "full",
    label: "Full",
    description: "Complete setup with historical data and all user roles.",
    entities: [
      "5 areas",
      "4 lines per area",
      "6 assets per line",
      "4 teams",
      "5 users",
      "30 days history",
      "~200 events",
      "3 connectors",
    ],
  },
];

export function SeedPresetSelector({
  value,
  onChange,
}: {
  value: SeedPreset;
  onChange: (preset: SeedPreset) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => onChange(preset.value)}
          className={`rounded-xl border p-4 text-left transition-colors ${
            value === preset.value
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border hover:border-primary/50"
          }`}
        >
          <p className="text-sm font-semibold">{preset.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
          <ul className="mt-2 space-y-0.5">
            {preset.entities.map((e) => (
              <li key={e} className="text-xs text-muted-foreground">
                {e}
              </li>
            ))}
          </ul>
        </button>
      ))}
    </div>
  );
}
