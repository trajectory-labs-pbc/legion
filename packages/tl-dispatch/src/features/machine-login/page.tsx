import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { ReadFailure, readFailureOf } from "@/data/read-failure";
import { NotFound } from "@/features/not-found";
import { loadNamed } from "@/loading/lazy-named";
import { PageSkeleton, useSkeleton } from "@/loading/page-skeleton";
import { credentialCapabilitiesQuery, machineLoginsQuery } from "@/upstream/queries";

/**
 * The page's code, kept in the query cache so a revisit draws the page at once; no refresh or
 * invalidation asks for it again. A failed load is kept until the route mounts again or a failed
 * read's Retry asks for the code too.
 */
const pageCodeQuery = queryOptions({
  queryKey: ["tl-dispatch", "machine-login-page-code"],
  queryFn: () => loadNamed(() => import("./machine-login-page"), "MachineLoginPage"),
  gcTime: Number.POSITIVE_INFINITY,
  staleTime: "static",
  retry: false,
});

/**
 * Served only while the broker still serves the device grant. One skeleton covers both waits,
 * the capabilities answer and the page's code, so nothing suspends into the outlet after it.
 */
export function MachineLoginRoute(): ReactNode {
  const capabilities = useQuery(credentialCapabilitiesQuery());
  const code = useQuery(pageCodeQuery);
  const queryClient = useQueryClient();
  // The logins list loads beside the read.
  useEffect(() => {
    void queryClient.prefetchQuery(machineLoginsQuery());
  }, [queryClient]);
  const read = readFailureOf(capabilities);
  // Retry also loads a failed page's code again, which nothing else asks for.
  const fault = read && {
    ...read,
    retry: () => {
      read.retry();
      if (code.isError) void code.refetch();
    },
  };
  const served = capabilities.data?.machine_code_page === true;
  // A query with no data goes back to pending when it loads again, so a refetch drops the failure.
  const waiting =
    fault === undefined && (capabilities.data === undefined || (served && code.isPending));
  const skeleton = useSkeleton(waiting);
  // A failed code load is the page's error only where the page is served, and it shows at once.
  if (served && code.isError) throw code.error;
  if (skeleton) return <PageSkeleton />;
  if (fault !== undefined) {
    return (
      <div className="max-w-180">
        <ReadFailure fault={fault} noun="the machine login page" size="default" />
      </div>
    );
  }
  if (!served) return waiting ? null : <NotFound />;
  return code.data === undefined ? null : <code.data />;
}
