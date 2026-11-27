import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { ReadFailure, readFailureOf } from "@/data/read-failure";
import { NotFound } from "@/features/not-found";
import { lazyNamed, loadNamed } from "@/loading/lazy-named";
import { PageSkeleton, useSkeleton } from "@/loading/page-skeleton";
import { credentialCapabilitiesQuery, machineLoginsQuery } from "@/upstream/queries";

const loadPage = () => import("./machine-login-page");
const LazyMachineLoginPage = lazyNamed(loadPage, "MachineLoginPage");

/**
 * Served only while the broker still serves the device grant. One skeleton covers both waits,
 * the capabilities answer and the page's code, so nothing suspends into the outlet after it.
 */
export function MachineLoginRoute(): ReactNode {
  const capabilities = useQuery(credentialCapabilitiesQuery());
  const queryClient = useQueryClient();
  // The page's code; "failed" draws the lazy page, whose load fails again into the error boundary.
  const [code, setCode] = useState<{ Page: ComponentType } | "failed">();
  // The page's code and its logins list load beside the read.
  useEffect(() => {
    let mounted = true;
    void loadNamed(loadPage, "MachineLoginPage").then(
      (Page) => {
        if (mounted) setCode({ Page });
      },
      () => {
        if (mounted) setCode("failed");
      }
    );
    void queryClient.prefetchQuery(machineLoginsQuery());
    return () => {
      mounted = false;
    };
  }, [queryClient]);
  const fault = readFailureOf(capabilities);
  const served = capabilities.data?.machine_code_page === true;
  const waiting =
    fault === undefined && (capabilities.data === undefined || (served && code === undefined));
  const skeleton = useSkeleton(waiting);
  if (skeleton) return <PageSkeleton />;
  if (fault !== undefined) {
    return (
      <div className="max-w-180">
        <ReadFailure fault={fault} noun="the machine login page" size="default" />
      </div>
    );
  }
  if (waiting) return null;
  if (!served) return <NotFound />;
  return typeof code === "object" ? <code.Page /> : <LazyMachineLoginPage />;
}
