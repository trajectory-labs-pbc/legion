import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/upstream/api";
import type { LauncherCredentialResp } from "@/upstream/contract";
import { credentialGrantsQuery, machineLoginsQuery } from "@/upstream/queries";
import { useKeyedWrite, useRefusalOfSubject, useSubmitGuard } from "@/upstream/writes";

export interface Revoke {
  /** Revokes the login; one revoke is out at a time. */
  send: (login: LauncherCredentialResp) => void;
  /** The login whose revoke is out. */
  pending: LauncherCredentialResp | undefined;
  /** The login whose revoke failed, while it is still listed. */
  refused: LauncherCredentialResp | undefined;
  /** Why that revoke failed. */
  error: unknown;
}

/** Whether `login` is still in the list. */
export const isListed = (
  listed: readonly LauncherCredentialResp[] | undefined,
  login: LauncherCredentialResp
) => listed?.some((other) => other.credential_id === login.credential_id) === true;

/** Revokes one machine login at a time, and holds the failure while the login is listed. */
export function useRevoke(listed: readonly LauncherCredentialResp[] | undefined): Revoke {
  const queryClient = useQueryClient();
  const submitGuard = useSubmitGuard();
  const mutation = useKeyedWrite({
    method: "POST",
    inline: true,
    label: (login: LauncherCredentialResp) => `Machine logins: revoke ${login.credential_id}`,
    onSettled: () => submitGuard.release(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: machineLoginsQuery().queryKey });
      void queryClient.invalidateQueries({ queryKey: credentialGrantsQuery().queryKey });
    },
    write: (login, bounds) => api.revokeMachineLogin(login.credential_id, bounds),
  });
  // The refusal goes once its login leaves the list.
  const refused = useRefusalOfSubject(mutation, (login) => isListed(listed, login));
  return {
    send: (login) => {
      submitGuard.guard(() => mutation.mutate(login));
    },
    pending: mutation.isPending ? mutation.variables : undefined,
    refused: refused ? mutation.variables : undefined,
    error: mutation.error,
  };
}
