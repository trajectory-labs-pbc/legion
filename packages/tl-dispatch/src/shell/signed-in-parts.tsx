import type { ReactNode } from "react";
import {
  AgentRegistryPoller,
  KeymapProvider,
  TextAskBlockCard,
  TextAskCard,
} from "@/upstream/shell";

export function SignedInParts({ children }: { children: ReactNode }): ReactNode {
  return (
    <KeymapProvider>
      <AgentRegistryPoller />
      <TextAskCard.Provider value={TextAskBlockCard}>{children}</TextAskCard.Provider>
    </KeymapProvider>
  );
}
