import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  createAlertDialogHandle,
} from "@legion/ui/components/alert-dialog";
import { Badge } from "@legion/ui/components/badge";
import { Button } from "@legion/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@legion/ui/components/collapsible";
import { Heading } from "@legion/ui/components/heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@legion/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@legion/ui/components/tooltip";
import { textVariants } from "@legion/ui/lib/typography";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useRef, useState } from "react";
import { ReadFailure, readFailureOf, refreshFailureOf } from "@/features/read-failure";
import { WriteFailure } from "@/writes/write-failure";
import {
  type FocusFallback,
  firstUsable,
  type LauncherCredentialResp,
  machineLoginsQuery,
  machineName,
  refusedNote,
  Timestamp,
  useFocusKeeper,
} from "./upstream";
import { isListed, type Revoke, useRevoke } from "./use-revoke";

type RevokeQuestion = ReturnType<typeof createAlertDialogHandle<LauncherCredentialResp>>;

const HEADINGS = ["Machine", "Credential", "Approved by", "Issued", "Expires"] as const;
/** Where the focus goes once a revoked row takes its Revoke away: a listed Revoke, else above the list. */
const afterRevoke = ({ root }: { root: HTMLElement | null }) =>
  firstUsable(
    ...(root?.querySelectorAll<HTMLElement>("tbody button") ?? []),
    root?.querySelector<HTMLElement>('[data-slot="collapsible-trigger"]')
  );
const FOCUS_FALLBACKS: readonly FocusFallback[] = [afterRevoke];
const MUTED = textVariants({ tone: "muted" });
const CUT_CELL = "w-1/4 max-w-0";

/** A long name cut to its cell, and shown in full in a tooltip. Its cell is `max-w-0` with a share
 *  of the width, so the table fits the page and the name takes what the other columns leave.
 *  While the name is cut it is a button, so the keyboard reaches it and opens the tooltip too. */
function Cut({ text }: { text: string }): ReactNode {
  const [cut, setCut] = useState(false);
  // Each element drawn is measured, and again whenever its width changes.
  const measure = useCallback((element: HTMLElement | null) => {
    if (element === null) return;
    const check = () => setCut(element.scrollWidth > element.clientWidth);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const name = "block w-full truncate text-left";
  return (
    <Tooltip>
      <TooltipTrigger
        // A new name is a new element, so it is measured anew.
        key={text}
        ref={measure}
        render={
          cut ? (
            <button
              className={`${name} rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
              type="button"
            />
          ) : (
            <span className={name} />
          )
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent className="max-w-(--available-width) wrap-anywhere">{text}</TooltipContent>
    </Tooltip>
  );
}

// A pod login (`person` set) and a service's token login have no approver.
function approvedBy(login: LauncherCredentialResp): string {
  if (login.subject == null) return login.approved_by;
  if (login.person != null) return `No one: BROKER_POD_OPERATORS maps ${login.subject} to you`;
  return `No one: ${login.subject}`;
}

// The credential id tells apart two logins of one service on one host.
const loginName = (login: LauncherCredentialResp) =>
  `the machine login for ${machineName(login)}, credential ${login.credential_id}`;

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

/** A row's Revoke, which asks first; it waits while another row's revoke is out. */
function RevokeButton({
  login,
  question,
  revoke,
}: {
  login: LauncherCredentialResp;
  question: RevokeQuestion;
  revoke: Revoke;
}): ReactNode {
  const pending = revoke.pending?.credential_id === login.credential_id;
  return (
    <AlertDialogTrigger
      handle={question}
      payload={login}
      render={
        <Button
          aria-label={`Revoke ${loginName(login)}`}
          disabled={revoke.pending !== undefined && !pending}
          loading={pending}
          size="sm"
          variant="outline"
        />
      }
    >
      Revoke
    </AlertDialogTrigger>
  );
}

/** The one question every row's Revoke asks, about the login that row passed it. */
function RevokeQuestionDialog({
  finalFocus,
  question,
  revoke,
}: {
  finalFocus: (login: LauncherCredentialResp) => HTMLElement | true | undefined;
  question: RevokeQuestion;
  revoke: Revoke;
}): ReactNode {
  return (
    <AlertDialog handle={question}>
      {({ payload: login }) =>
        login === undefined ? null : (
          <AlertDialogContent finalFocus={() => finalFocus(login)}>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke {machineName(login)}?</AlertDialogTitle>
              <AlertDialogDescription>
                Credential {login.credential_id}. {revokeOutcome(login)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => revoke.send(login)} variant="destructive">
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )
      }
    </AlertDialog>
  );
}

function LoginRows({
  logins,
  newCredential,
  question,
  revoke,
}: {
  logins: readonly LauncherCredentialResp[];
  newCredential: string | undefined;
  question: RevokeQuestion;
  revoke: Revoke;
}): ReactNode {
  const span = HEADINGS.length + 1;
  if (logins.length === 0) {
    return (
      <TableRow>
        <TableCell className={MUTED} colSpan={span}>
          No live machine logins.
        </TableCell>
      </TableRow>
    );
  }
  const { refused } = revoke;
  return logins.map((login) => (
    <Fragment key={login.credential_id}>
      <TableRow>
        <TableCell className={textVariants({ className: CUT_CELL, weight: "medium" })}>
          <Cut text={machineName(login)} />
          {login.expired ? (
            <span
              className={textVariants({
                className: "block truncate",
                size: "caption",
                tone: "muted",
              })}
            >
              expired, sessions still running
            </span>
          ) : null}
        </TableCell>
        <TableCell className={MUTED}>
          <span className={textVariants({ className: "font-mono", size: "caption" })}>
            {login.credential_id}
          </span>
          {login.credential_id === newCredential ? (
            <Badge className="ml-2" variant="success">
              New
            </Badge>
          ) : null}
        </TableCell>
        <TableCell className={textVariants({ className: CUT_CELL, tone: "muted" })}>
          <Cut text={approvedBy(login)} />
        </TableCell>
        <TableCell className={MUTED}>
          <Timestamp at={login.issued_at} className="whitespace-nowrap tabular-nums" />
        </TableCell>
        <TableCell className={MUTED}>
          <Timestamp at={login.expires_at} className="whitespace-nowrap tabular-nums" />
        </TableCell>
        <TableCell className="text-right">
          <RevokeButton login={login} question={question} revoke={revoke} />
        </TableCell>
      </TableRow>
      {refused?.credential_id === login.credential_id ? (
        <TableRow>
          <TableCell className="whitespace-normal" colSpan={span}>
            <WriteFailure
              anew="Pressing Revoke again sends a new revoke."
              error={revoke.error}
              refused={(error) => refusedNote(`revoke ${loginName(refused)}`, error)}
              what={`the revoke of ${loginName(refused)}`}
            />
          </TableCell>
        </TableRow>
      ) : null}
    </Fragment>
  ));
}

/** The machine logins the viewer may revoke that can still reach a secret; `newCredential` is the
 *  one this page just approved, marked New. */
export function MachineLogins({ newCredential }: { newCredential?: string }): ReactNode {
  const logins = useQuery({ ...machineLoginsQuery(), select: (data) => data.credentials ?? [] });
  // The refusal follows the rows shown, which come from the same query.
  const revoke = useRevoke(logins.data);
  const [question] = useState(createAlertDialogHandle<LauncherCredentialResp>);
  const [howOpen, setHowOpen] = useState(false);
  const section = useRef<HTMLElement>(null);
  useFocusKeeper(section, FOCUS_FALLBACKS);
  // Back to its row's Revoke, or, once a revoke took the row, where the keeper would put it.
  const finalFocus = (login: LauncherCredentialResp) =>
    isListed(logins.data, login) || afterRevoke({ root: section.current });
  const fault = readFailureOf(logins);
  const refreshFault = refreshFailureOf(logins);
  return (
    <section aria-labelledby="machine-logins-heading" className="space-y-3" ref={section}>
      <div className="space-y-1">
        <Heading id="machine-logins-heading" size="section">
          Machine logins
        </Heading>
        <Collapsible onOpenChange={setHowOpen} open={howOpen}>
          <CollapsibleTrigger render={<Button size="sm" variant="link" />}>
            How machine logins work
            {howOpen ? (
              <ChevronDownIcon aria-hidden data-icon="inline-end" />
            ) : (
              <ChevronRightIcon aria-hidden data-icon="inline-end" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className={textVariants({ className: "text-pretty", tone: "muted" })}>
              Every machine and every pod logged in as you, and every service's login. A pod logs in
              as you when the broker's BROKER_POD_OPERATORS maps the pod's Kubernetes account to
              you. The list shows a login while it is unexpired or a session it started still runs:
              a session outlives its login's expiry. Only you may revoke the logins of your machines
              and your pods. Anyone signed in may revoke a service's login. Revoking a login ends it
              now: it starts no more sessions, and every session it started loses its secrets.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {refreshFault !== undefined ? (
        <ReadFailure fault={refreshFault} noun="the latest machine logins" />
      ) : null}
      {logins.data !== undefined ? (
        <div className="overflow-clip rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {HEADINGS.map((heading) => (
                  <TableHead key={heading} scope="col">
                    {heading}
                  </TableHead>
                ))}
                <TableHead scope="col">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <LoginRows
                logins={logins.data}
                newCredential={newCredential}
                question={question}
                revoke={revoke}
              />
            </TableBody>
          </Table>
        </div>
      ) : fault !== undefined ? (
        <ReadFailure fault={fault} noun="machine logins" />
      ) : (
        <p className={MUTED}>Loading machine logins…</p>
      )}
      <RevokeQuestionDialog finalFocus={finalFocus} question={question} revoke={revoke} />
    </section>
  );
}
