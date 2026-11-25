import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { type RevocableColumn, RevocableTable } from "./revocable-table";
import {
  api,
  credentialGrantsQuery,
  type LauncherCredentialResp,
  machineLoginsQuery,
  machineName,
  Timestamp,
} from "./upstream";
import { useRevoke } from "./use-revoke";

// A pod login (`person` set) and a service's token login have no approver.
function approvedBy(login: LauncherCredentialResp): string {
  if (login.subject == null) return login.approved_by;
  if (login.person != null) return `No one: BROKER_POD_OPERATORS maps ${login.subject} to you`;
  return `No one: ${login.subject}`;
}

/** What revoking a login ends, and what logs in again after it. */
function revokeOutcome(login: LauncherCredentialResp): string {
  if (login.person != null) {
    return "Every session it started ends at once. The pod logs in again with its token, under a new login, while the broker's BROKER_SERVICE_LOGINS names its Kubernetes account, and that login is yours while BROKER_POD_OPERATORS maps the account to you.";
  }
  if (!login.service) {
    return "Every agent session it started loses its secrets at once, and the machine needs a new login.";
  }
  if (login.subject == null) {
    return "Every session it started, its worker pods included, ends at once.";
  }
  return `Every session it started, its worker pods included, ends at once, and a running pod stays without secrets until it is replaced; ${login.service} logs in again with its Kubernetes token, for the pods it launches next, unless ${login.subject} is removed from the broker's BROKER_SERVICE_LOGINS.`;
}

const columns: readonly RevocableColumn<LauncherCredentialResp>[] = [
  {
    cell: (login) => (
      <>
        {machineName(login)}
        {login.expired ? (
          <span className="block text-xs font-normal text-muted-foreground">
            expired, sessions still running
          </span>
        ) : null}
      </>
    ),
    header: "Machine",
  },
  {
    cell: (login) => <span className="font-mono text-xs">{login.credential_id}</span>,
    header: "Credential",
  },
  { cell: approvedBy, header: "Approved by" },
  {
    cell: (login) => <Timestamp at={login.issued_at} className="whitespace-nowrap tabular-nums" />,
    header: "Issued",
  },
  {
    cell: (login) => <Timestamp at={login.expires_at} className="whitespace-nowrap tabular-nums" />,
    header: "Expires",
  },
];

const rowKey = (login: LauncherCredentialResp) => login.credential_id;

/** The machine logins the viewer may revoke that can still reach a secret. */
export function MachineLogins(): ReactNode {
  const queryClient = useQueryClient();
  const logins = useQuery({ ...machineLoginsQuery(), select: (data) => data.credentials ?? [] });
  const revoke = useRevoke({
    confirm: (login) =>
      `Revoke the machine login for ${machineName(login)}? ${revokeOutcome(login)}`,
    label: (login) => `Machine logins: revoke ${rowKey(login)}`,
    listed: logins.data,
    onRevoked: () => {
      void queryClient.invalidateQueries({ queryKey: machineLoginsQuery().queryKey });
      void queryClient.invalidateQueries({ queryKey: credentialGrantsQuery().queryKey });
    },
    revoke: (login, bounds) => api.revokeMachineLogin(login.credential_id, bounds),
    rowKey,
  });

  return (
    <RevocableTable
      columns={columns}
      description="Every machine and every pod logged in as you, and every service's login. A pod logs in as you when the broker's BROKER_POD_OPERATORS maps the pod's Kubernetes account to you. The list shows a login while it is unexpired or a session it started still runs: a session outlives its login's expiry. Only you may revoke the logins of your machines and your pods. Anyone signed in may revoke a service's login. Revoking a login ends it now: it starts no more sessions, and every session it started loses its secrets."
      empty="No live machine logins."
      heading="Machine logins"
      headingId="machine-logins-heading"
      noun="machine logins"
      query={logins}
      revoke={revoke}
      rowKey={rowKey}
      rowName={(login) => `the machine login for ${machineName(login)}`}
    />
  );
}
