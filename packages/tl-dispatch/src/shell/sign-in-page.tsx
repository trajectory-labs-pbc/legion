import { useQueryClient } from "@tanstack/react-query";
import { KeptWrites } from "@upstream-dispatch/features/writes/KeptWrites";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import {
  primaryButtonBg,
  primaryButtonHoverBg,
  textSecondaryOnSurface,
} from "@upstream-dispatch/theme/classes";
import type { ReactNode } from "react";

import { ShellMessagePage } from "./shell-message-page";

/** The sign-in page; a lapsed session shows the writes it keeps. */
export function SignInPage(): ReactNode {
  const queryClient = useQueryClient();
  return (
    <ShellMessagePage title="Make the next decision clear.">
      <p className={`mt-3 ${textSecondaryOnSurface}`}>
        Sign in to review your team&apos;s open decisions.
      </p>
      <a
        className={`mt-8 inline-flex rounded-lg px-4 py-2 font-semibold ${primaryButtonBg} ${primaryButtonHoverBg}`}
        href="/auth/start"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          writesOf(queryClient).leavingToSignIn();
        }}
      >
        Sign in with Google
      </a>
      <KeptWrites />
    </ShellMessagePage>
  );
}
