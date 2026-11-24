import { isUnauthorized } from "@upstream-dispatch/api/client";
import { useEventFeed } from "@upstream-dispatch/api/event-feed";
import { whoAmIQuery } from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import {
  draftStoresSignedIn,
  draftStoresSignedOut,
} from "@upstream-dispatch/features/conversation/unsent-drafts";
import { TextAskBlockCard } from "@upstream-dispatch/features/doc/AskBlockCard";
import { AgentRegistryPoller } from "@upstream-dispatch/features/refs/agent-registry";
import { TextAskCard } from "@upstream-dispatch/features/refs/markdown-cards";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
import "@upstream-dispatch/features/writes/kinds";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import { type ReactNode, useEffect, useState } from "react";

import { AppShell } from "./AppShell";
import { signIns } from "./sign-ins";
import { ConnectionErrorPage, ShellSkeleton, SignInPage } from "./states";
import { useSignInChannel } from "./use-sign-in-channel";

function AuthenticatedApp({ user }: { user: AuthenticatedUser }): ReactNode {
  const queryClient = useQueryClient();
  const login = user.login;
  // Writes a reload interrupted go on, once, before any page writes.
  useEffect(() => {
    writesOf(queryClient).resume(login);
  }, [login, queryClient]);
  useEventFeed();
  return (
    <KeymapProvider>
      <AgentRegistryPoller />
      <TextAskCard.Provider value={TextAskBlockCard}>
        <AppShell user={user} />
      </TextAskCard.Provider>
    </KeymapProvider>
  );
}

export function AuthGate(): ReactNode {
  const queryClient = useQueryClient();
  const whoAmI = useQuery(whoAmIQuery());
  // A 401 ends this page's session: drop every read made for the person who left.
  const signedOut = whoAmI.isError && isUnauthorized(whoAmI.error);
  useEffect(() => {
    if (!signedOut) return;
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "whoami" });
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
    return <SignInPage />;
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
