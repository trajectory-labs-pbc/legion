import { MessagePage } from "@legion/ui/blocks/message-page";
import { Button } from "@legion/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { KeptWrites } from "@upstream-dispatch/features/writes/KeptWrites";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import type { ReactNode } from "react";

/** The sign-in page; a lapsed session shows the writes it keeps. */
export function SignInPage(): ReactNode {
  const queryClient = useQueryClient();
  return (
    <MessagePage eyebrow="Dispatch" title="Make the next decision clear.">
      <p className="mt-3 text-sm text-muted-foreground">
        Sign in to review your team&apos;s open decisions.
      </p>
      <Button
        className="mt-8"
        render={
          // biome-ignore lint/a11y/useAnchorContent: the button gives the link its words
          <a
            href="/auth/start"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              writesOf(queryClient).leavingToSignIn();
            }}
          />
        }
        size="lg"
      >
        Sign in with Google
      </Button>
      <KeptWrites />
    </MessagePage>
  );
}
