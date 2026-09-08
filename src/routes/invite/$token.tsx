import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useInvitationInfo, useAcceptInvitation } from "@/lib/admin-hooks";
import { setToken, setRefreshToken } from "@/lib/api";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "Accept Invitation | OptiLog" }],
  }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const router = useRouter();
  const info = useInvitationInfo(token);
  const acceptInvitation = useAcceptInvitation();

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    try {
      const result = await acceptInvitation.mutateAsync({ token, name, password });
      setToken(result.access_token);
      setRefreshToken(result.refresh_token);
      router.navigate({ to: "/console" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    }
  };

  if (info.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (info.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Invalid invitation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation link is invalid or has expired.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to login
          </a>
        </div>
      </div>
    );
  }

  const data = info.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-black tracking-[0.2em] text-primary">OPTILOG</p>
          <h1 className="mt-4 text-xl font-semibold">Welcome to OptiLog</h1>
          {data && (
            <p className="mt-2 text-sm text-muted-foreground">
              You've been invited to join OptiLog as a{" "}
              <strong>{data.role.replace(/_/g, " ")}</strong>.
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
                minLength={8}
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={acceptInvitation.isPending || !name.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {acceptInvitation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
