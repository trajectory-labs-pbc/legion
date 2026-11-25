import { Button } from "@legion/ui/components/button";
import { MessagePage } from "@legion/ui/components/message-page";
import type { ReactNode } from "react";

/** Shown when the sign-in check got no answer. */
export function ConnectionErrorPage({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <MessagePage eyebrow="Dispatch" title="Couldn't reach Dispatch.">
      <div className="mt-4" role="alert">
        <Button onClick={onRetry} variant="outline">
          Retry
        </Button>
      </div>
    </MessagePage>
  );
}
