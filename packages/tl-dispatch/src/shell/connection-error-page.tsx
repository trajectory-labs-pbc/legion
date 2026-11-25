import { MessagePage } from "@legion/ui/blocks/message-page";
import { Button } from "@legion/ui/components/button";
import type { ReactNode } from "react";

/** Shown when the sign-in check got no answer. */
export function ConnectionErrorPage({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <MessagePage eyebrow="Dispatch" title={<span role="alert">Could not reach Dispatch.</span>}>
      <div className="mt-4">
        <Button onClick={onRetry} variant="outline">
          Retry
        </Button>
      </div>
    </MessagePage>
  );
}
