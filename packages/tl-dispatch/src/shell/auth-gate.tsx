import { type ReactNode, Suspense } from "react";
import {
  type AuthenticatedUser,
  sessionEnded,
  useAskSessionAgain,
  useSession,
} from "@/data/session";
import { useSignedInFeed, useSignedInStores } from "@/data/sign-ins";
import { useSignInChannel } from "@/data/use-sign-in-channel";
import { lazyNamed } from "@/loading/lazy-named";

import { AppShell } from "./app-shell";
import { ConnectionErrorPage } from "./connection-error-page";
import { ShellSkeleton } from "./shell-skeleton";
import { SignedInParts } from "./signed-in-parts";

// A signed-in reader never needs the sign-in page's code.
const SignInPage = lazyNamed(() => import("./sign-in-page"), "SignInPage");

function AuthenticatedApp({ user }: { user: AuthenticatedUser }): ReactNode {
  useSignedInFeed(user.login);
  return (
    <SignedInParts>
      <AppShell user={user} />
    </SignedInParts>
  );
}

export function AuthGate(): ReactNode {
  const session = useSession();
  const shellFor = useSignedInStores(session);
  const askSessionAgain = useAskSessionAgain();
  useSignInChannel();

  // A check again of one that failed with nothing to show, a refused one included.
  if (session.state === "loading" || (session.state === "error" && session.retrying)) {
    return <ShellSkeleton />;
  }
  if (sessionEnded(session)) {
    return (
      <Suspense fallback={<ShellSkeleton />}>
        <SignInPage />
      </Suspense>
    );
  }
  if (session.state === "ready") {
    return shellFor === session.data.login ? (
      <AuthenticatedApp user={session.data} />
    ) : (
      <ShellSkeleton />
    );
  }
  // Dispatch never refuses the check itself, but a proxy in front of it may.
  return <ConnectionErrorPage onRetry={session.retry ?? askSessionAgain} />;
}
