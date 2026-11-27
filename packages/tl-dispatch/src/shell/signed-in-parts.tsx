import type { ReactNode } from "react";
import { KeymapProvider, TextAskBlockCard, TextAskCard } from "@/upstream/shell";

export function SignedInParts({ children }: { children: ReactNode }): ReactNode {
  return (
    <KeymapProvider>
      <TextAskCard.Provider value={TextAskBlockCard}>{children}</TextAskCard.Provider>
    </KeymapProvider>
  );
}
