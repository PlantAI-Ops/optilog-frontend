import { createFileRoute } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/console/ConsoleShell";
import { LayoutBoard } from "@/components/console/LayoutBoard";

export const Route = createFileRoute("/console/layout")({
  head: () => ({
    meta: [
      { title: "Layout | OptiLog Operations Console" },
      {
        name: "description",
        content:
          "Form teams and assign members to them, then place teams onto the plant's lines with drag and drop.",
      },
      { property: "og:title", content: "Layout | OptiLog" },
      { property: "og:description", content: "Drag-and-drop team and line layout." },
    ],
  }),
  component: LayoutPage,
});

function LayoutPage() {
  return (
    <ConsoleShell
      title="Layout"
      subtitle="Form teams and place them on lines — areas are zones along each line"
    >
      <LayoutBoard />
    </ConsoleShell>
  );
}
