import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { askSignInAgain } from "@/upstream/api";
import type { SignInChannel } from "@/upstream/data-hooks";
import { writesOf } from "@/upstream/writes";

import { heldWritesOfGoneHolder, signIns, unsentChanges } from "./sign-ins";

/** Answers the other tabs' sign-ins and sign-outs with this tab's writes, while mounted. */
export function useSignInChannel(channel: Pick<SignInChannel, "listen"> = signIns): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const writes = writesOf(queryClient);
    return channel.listen({
      changed: () => void askSignInAgain(queryClient),
      holderGone: (gone) => void heldWritesOfGoneHolder(queryClient, gone),
      signedOut: (signedOut) => writes.dropLogin(signedOut),
      signingOut: (signingOut) => writes.holdFor(signingOut),
      stillSignedIn: (still) => writes.release(still),
      unsent: (of) => unsentChanges(writes.rows(), of),
    });
  }, [channel, queryClient]);
}
