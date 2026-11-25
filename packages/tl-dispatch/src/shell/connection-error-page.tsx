import { linkHoverText, linkText } from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

import { ShellMessagePage } from "./shell-message-page";

/** Shown when the sign-in check got no answer. */
export function ConnectionErrorPage({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <ShellMessagePage title="Couldn't reach Dispatch.">
      <div className="mt-4" role="alert">
        <button
          className={`text-sm font-medium underline ${linkText} ${linkHoverText}`}
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    </ShellMessagePage>
  );
}
