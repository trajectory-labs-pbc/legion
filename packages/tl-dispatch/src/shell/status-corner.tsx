import { Alert, AlertAction, AlertTitle } from "@legion/ui/components/alert";
import { Badge } from "@legion/ui/components/badge";
import { Button } from "@legion/ui/components/button";
import { useRef } from "react";
import { useLiveSocketPill } from "@/data/live";
import { useFootInset } from "@/upstream/shell";
import { DraftsNotKept, PendingWritesIndicator } from "@/upstream/widgets/status";
import type { SignOut } from "./use-sign-out";

/**
 * The corner that reports writes on their way, a sign-out under way or refused, and a live feed
 * that stopped: the one float of the foot's status layer, 1rem above the banner layer and never
 * under its floor. A sign-out runs from the account menu or the palette, so it shows here, whether
 * the sidebar is drawn, folded or a closed drawer.
 */
export function StatusCorner({
  signOut,
}: {
  signOut?: Pick<SignOut, "start" | "pending" | "error" | "clearError">;
}) {
  const corner = useRef<HTMLDivElement>(null);
  useFootInset(corner, true, "status");
  const connection = useLiveSocketPill();
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[max(var(--foot-floor),calc(var(--foot-banner-inset,0px)_+_1rem))] z-overlay flex w-[min(28rem,calc(100vw-2rem))] flex-col items-end gap-2 [--foot-floor:5rem] xl:[--foot-floor:0px] *:pointer-events-auto"
      ref={corner}
    >
      <PendingWritesIndicator />
      <DraftsNotKept />
      {signOut?.error === undefined ? null : (
        <Alert size="compact" variant="danger">
          <AlertTitle>{signOut.error}</AlertTitle>
          <AlertAction className="flex gap-1">
            <Button loading={signOut.pending} onClick={signOut.start} size="xs" variant="outline">
              Retry
            </Button>
            <Button
              disabled={signOut.pending}
              onClick={signOut.clearError}
              size="xs"
              variant="ghost"
            >
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      )}
      {/* Never hidden, so a screen reader announces a line when it appears; empty, it takes no room. */}
      <div
        className="flex flex-col items-end gap-2 empty:-mt-2"
        data-testid="connection-status"
        role="status"
      >
        {signOut?.pending === true && signOut.error === undefined ? (
          <Badge className="px-3 py-1" data-testid="signing-out" variant="muted">
            Signing out…
          </Badge>
        ) : null}
        {connection === "stuck" ? (
          <Badge className="gap-2 px-3 py-1" data-testid="connection-pill" variant="danger">
            Live updates are not reaching this page
            <Button onClick={() => window.location.reload()} size="xs" variant="outline">
              Reload
            </Button>
          </Badge>
        ) : connection === "reconnecting" ? (
          <Badge className="px-3 py-1" data-testid="connection-pill" variant="muted">
            Reconnecting…
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
