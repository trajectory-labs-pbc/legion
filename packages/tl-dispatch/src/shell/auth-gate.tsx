import { isUnauthorized } from "@/upstream/api";
import type { AuthenticatedUser } from "@/upstream/contract";
import { draftStoresSignedIn, draftStoresSignedOut } from "@/upstream/data-hooks";
import { useEventFeed } from "@/upstream/live";
import { whoAmIQuery } from "@/upstream/queries";
import "@/upstream/write-kinds";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, Suspense, useEffect, useState } from "react";
import { lazyNamed } from "@/loading/lazy-named";
import { writesOf } from "@/upstream/writes";

import { AppShell } from "./app-shell";
import { ConnectionErrorPage } from "./connection-error-page";
import { forgetReads } from "./forget-reads";
import { ShellSkeleton } from "./shell-skeleton";
import { signIns } from "./sign-ins";
import { SignedInParts } from "./signed-in-parts";
import { useSignInChannel } from "./use-sign-in-channel";

// A signed-in reader never needs the sign-in page's code.
const SignInPage = lazyNamed(() => import("./sign-in-page"), "SignInPage");

function AuthenticatedApp({ user }: { user: AuthenticatedUser }): ReactNode {
  const queryClient = useQueryClient();
  const login = user.login;
  // Writes a reload interrupted go on, once, before any page writes.
  useEffect(() => {
    writesOf(queryClient).resume(login);
  }, [login, queryClient]);
  useEventFeed();
  return (
    <SignedInParts>
      <AppShell user={user} />
    </SignedInParts>
  );
}

export function AuthGate(): ReactNode {
  const queryClient = useQueryClient();
  const whoAmI = useQuery(whoAmIQuery());
  // A 401 ends this page's session: drop every read made for the person who left.
  const signedOut = whoAmI.isError && isUnauthorized(whoAmI.error);
  useEffect(() => {
    if (!signedOut) return;
    forgetReads(queryClient);
  }, [queryClient, signedOut]);
  useEffect(
    () => writesOf(queryClient).onSignedOut((person) => draftStoresSignedOut(queryClient, person)),
    [queryClient]
  );
  const login = signedOut ? undefined : whoAmI.data?.login;
  const known = signedOut || whoAmI.data !== undefined;
  // The shell is drawn for a person only in the commit after the stores were told of them.
  const [shellFor, setShellFor] = useState<string>();
  useEffect(() => {
    if (!known) return;
    writesOf(queryClient).signedIn(login);
    draftStoresSignedIn(queryClient, login);
    signIns.signedIn(login ?? null);
    if (login !== undefined) setShellFor(login);
  }, [known, login, queryClient]);
  useSignInChannel();

  if (whoAmI.isPending) {
    return <ShellSkeleton />;
  }
  if (signedOut) {
    return (
      <Suspense fallback={<ShellSkeleton />}>
        <SignInPage />
      </Suspense>
    );
  }
  if (whoAmI.data !== undefined) {
    return shellFor === whoAmI.data.login ? (
      <AuthenticatedApp user={whoAmI.data} />
    ) : (
      <ShellSkeleton />
    );
  }
  return <ConnectionErrorPage onRetry={() => void whoAmI.refetch()} />;
}
