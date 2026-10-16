import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The queue moved to /console/reports (with vocabulary split off to
 * /console/vocabulary). Keep the old path alive so bookmarks and deep links
 * land on the renamed tab instead of a 404.
 */
export const Route = createFileRoute("/console/approvals")({
  beforeLoad: () => {
    throw redirect({ to: "/console/reports" });
  },
  component: () => null,
});
