import { installChunkFailureRecovery } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { useEffect } from "react";

/** Reloads the page once when a deploy removed a chunk it still asks for, while mounted. */
export function useStaleChunkReload(install: () => () => void = installChunkFailureRecovery): void {
  useEffect(() => install(), [install]);
}
