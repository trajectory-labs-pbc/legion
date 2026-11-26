import { TextAskBlockCard } from "@upstream-dispatch/features/doc/AskBlockCard";
import { AgentRegistryPoller } from "@upstream-dispatch/features/refs/agent-registry";
import { TextAskCard } from "@upstream-dispatch/features/refs/markdown-cards";
import { KeymapProvider } from "@upstream-dispatch/features/shell/KeymapProvider";
import type { ReactNode } from "react";

export function SignedInParts({ children }: { children: ReactNode }): ReactNode {
  return (
    <KeymapProvider>
      <AgentRegistryPoller />
      <TextAskCard.Provider value={TextAskBlockCard}>{children}</TextAskCard.Provider>
    </KeymapProvider>
  );
}
