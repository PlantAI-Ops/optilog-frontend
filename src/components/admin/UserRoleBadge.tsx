import type { Role } from "@/lib/shift-log";

const ROLE_STYLES: Record<Role, string> = {
  operator: "bg-muted text-muted-foreground border-border",
  technician: "bg-primary/10 text-primary border-primary/20",
  supervisor: "bg-success/10 text-success border-success/20",
  shift_manager: "bg-warning/10 text-warning border-warning/20",
  plant_manager: "bg-primary/10 text-primary border-primary/20",
  integration_admin: "bg-purple/10 text-purple border-purple/20",
  system_admin: "bg-destructive/10 text-destructive border-destructive/20",
};

const ROLE_LABELS: Record<Role, string> = {
  operator: "Operator",
  technician: "Technician",
  supervisor: "Supervisor",
  shift_manager: "Shift Mgr",
  plant_manager: "Plant Mgr",
  integration_admin: "Integration",
  system_admin: "Sys Admin",
};

interface UserRoleBadgeProps {
  role: Role;
  variant?: "default" | "compact";
  className?: string;
}

export function UserRoleBadge({ role, variant = "default", className = "" }: UserRoleBadgeProps) {
  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ROLE_STYLES[role]} ${className}`}
      >
        {ROLE_LABELS[role]}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_STYLES[role]} ${className}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}