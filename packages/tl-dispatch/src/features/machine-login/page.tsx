import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { ReadFailure, useReadFailure } from "@/data/read-failure";
import { NotFound } from "@/features/not-found";
import { lazyNamed } from "@/loading/lazy-named";
import { PageFallback } from "@/loading/page-skeleton";
import { credentialCapabilitiesQuery, machineLoginsQuery } from "@/upstream/queries";

const loadPage = () => import("./machine-login-page");
const MachineLoginPage = lazyNamed(loadPage, "MachineLoginPage");

/** Served only while the broker still serves the device grant; a skeleton while that answer is out. */
export function MachineLoginRoute(): ReactNode {
  const capabilitiesQuery = credentialCapabilitiesQuery();
  const capabilities = useQuery(capabilitiesQuery);
  const queryClient = useQueryClient();
  // The page's code and its logins list load beside the read; a failed load fails again, shown,
  // on mount.
  useEffect(() => {
    void loadPage().catch(() => undefined);
    void queryClient.prefetchQuery(machineLoginsQuery());
  }, [queryClient]);
  const fault = useReadFailure({ read: capabilities, key: capabilitiesQuery.queryKey });
  // A 404 of the page's own read: the server has no machine login page.
  if (fault?.refusal === "not-found") return <NotFound />;
  if (fault !== undefined) {
    return (
      <div className="max-w-180">
        <ReadFailure fault={fault} noun="the machine login page" size="default" />
      </div>
    );
  }
  if (capabilities.data === undefined) return <PageFallback />;
  return capabilities.data.machine_code_page === true ? <MachineLoginPage /> : <NotFound />;
}
