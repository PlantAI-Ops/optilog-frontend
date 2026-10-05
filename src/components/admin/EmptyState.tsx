import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "outline";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  variant?: "inline" | "section";
  stats?: { label: string; value: string }[];
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "inline",
  stats,
}: EmptyStateProps) {
  const isSection = variant === "section";

  return (
    <div
      className={`rounded-xl border ${
        isSection
          ? "border-dashed border-border bg-card/50 p-8"
          : "border-border bg-card p-6"
      } text-center`}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground max-w-md mx-auto">
        {description}
      </p>
      {stats && stats.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          {stats.map((stat, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="font-medium tabular-nums">{stat.value}</span>
              <span>of</span>
              <span>{stat.label}</span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
        {action && (
          <Button
            variant={action.variant === "outline" ? "outline" : "default"}
            onClick={action.onClick}
            className="h-9"
          >
            {action.icon && <action.icon className="mr-2 h-4 w-4" />}
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button
            variant={secondaryAction.variant === "primary" ? "default" : "outline"}
            onClick={secondaryAction.onClick}
            className="h-9"
          >
            {secondaryAction.icon && <secondaryAction.icon className="mr-2 h-4 w-4" />}
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}