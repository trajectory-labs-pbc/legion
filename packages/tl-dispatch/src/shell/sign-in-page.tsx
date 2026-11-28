import { MessagePage } from "@legion/ui/blocks/message-page";
import { Button } from "@legion/ui/components/button";
import { textVariants } from "@legion/ui/lib/typography";
import type { ReactNode } from "react";
import { useLeaveToSignIn } from "@/data/sign-ins";
import { KeptWrites } from "@/upstream/widgets/kept-writes";

/** The sign-in page; a lapsed session shows the writes it keeps. */
export function SignInPage(): ReactNode {
  const leaveToSignIn = useLeaveToSignIn();
  return (
    <MessagePage eyebrow="Dispatch" title="Make the next decision clear.">
      <p className={textVariants({ className: "mt-3", tone: "muted" })}>
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
              leaveToSignIn();
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
