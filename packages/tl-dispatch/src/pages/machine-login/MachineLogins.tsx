import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@upstream-dispatch/api/client";
import type { LauncherCredentialResp } from "@upstream-dispatch/api/types";
import { credentialGrantsQuery } from "@upstream-dispatch/features/credentials/grants";
import {
  machineLoginsQuery,
  machineName,
} from "@upstream-dispatch/features/credentials/machineLogins";
import { Timestamp } from "@upstream-dispatch/features/refs/Timestamp";
import type { ReactNode } from "react";

import { type RevocableColumn, RevocableTable } from "./RevocableTable";

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
  {
    // A broker older than this Dispatch sends no `subject`.
    cell: (login) => (login.subject == null ? login.approved_by : `No one: ${login.subject}`),
    header: "Approved by",
  },
  {
    cell: (login) => <Timestamp at={login.issued_at} className="whitespace-nowrap tabular-nums" />,
    header: "Issued",
  },
  {
    cell: (login) => <Timestamp at={login.expires_at} className="whitespace-nowrap tabular-nums" />,
    header: "Expires",
  },
];

/** The machine logins the viewer may revoke that can still reach a secret. */
export function MachineLogins(): ReactNode {
  const queryClient = useQueryClient();
  const logins = useQuery({ ...machineLoginsQuery(), select: (data) => data.credentials ?? [] });

  return (
    <RevocableTable
      columns={columns}
      confirm={(login) =>
        `Revoke the machine login for ${machineName(login)}? ${
          login.service
            ? login.subject == null
              ? "Every session it started, its worker pods included, ends at once."
              : `Every session it started, its worker pods included, ends at once, and a running pod stays without secrets until it is replaced; ${login.service} logs in again with its Kubernetes token, for the pods it launches next, unless ${login.subject} is removed from the broker's BROKER_SERVICE_LOGINS.`
            : "Every agent session it started loses its secrets at once, and the machine needs a new login."
        }`
      }
      description="Every machine logged in as you, and every service's login, which anyone signed in may revoke, while its login is unexpired or a session it started still runs: a session outlives its login's expiry. Revoking one ends it now: it starts no more sessions, and every session it started loses its secrets."
      empty="No live machine logins."
      heading="Machine logins"
      headingId="machine-logins-heading"
      noun="machine logins"
      onRevoked={() => {
        void queryClient.invalidateQueries({ queryKey: machineLoginsQuery().queryKey });
        void queryClient.invalidateQueries({ queryKey: credentialGrantsQuery().queryKey });
      }}
      query={logins}
      revoke={(login, bounds) => api.revokeMachineLogin(login.credential_id, bounds)}
      revokeError="Could not revoke this machine login."
      rowKey={(login) => login.credential_id}
    />
  );
}
