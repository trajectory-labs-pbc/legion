import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { ReadFailure, readFailureOf } from "@/data/read-failure";
import { NotFound } from "@/features/not-found";
import { loadNamed } from "@/loading/lazy-named";
import { PageSkeleton, useSkeleton } from "@/loading/page-skeleton";
import { credentialCapabilitiesQuery, machineLoginsQuery } from "@/upstream/queries";

/**
 * The page's code, kept in the query cache so a revisit draws the page at once. A failed load
 * throws into the error boundary, as a lazy page's does.
 */
const pageCodeQuery = queryOptions({
  queryKey: ["tl-dispatch", "machine-login-page-code"],
  queryFn: () => loadNamed(() => import("./machine-login-page"), "MachineLoginPage"),
  gcTime: Number.POSITIVE_INFINITY,
  staleTime: Number.POSITIVE_INFINITY,
  retry: false,
  throwOnError: true,
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
  const fault = readFailureOf(capabilities);
  const served = capabilities.data?.machine_code_page === true;
  const waiting =
    fault === undefined && (capabilities.data === undefined || (served && code.data === undefined));
  const skeleton = useSkeleton(waiting);
  if (skeleton) return <PageSkeleton />;
  if (fault !== undefined) {
    return (
      <div className="max-w-180">
        <ReadFailure fault={fault} noun="the machine login page" size="default" />
      </div>
    );
  }
  const Page = code.data;
  if (waiting) return null;
  if (!served) return <NotFound />;
  return Page === undefined ? null : <Page />;
}
