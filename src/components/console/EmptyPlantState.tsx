interface EmptyPlantStateProps {
  title: string;
  description: string;
}

/**
 * Shared "nothing to show yet" card for plant-scoped console pages.
 * Render only after the driving query has succeeded, never while loading.
 */
export function EmptyPlantState({ title, description }: EmptyPlantStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
