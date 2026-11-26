import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { ReadFailure, readFailureOf } from "@/features/read-failure";
import { lazyNamed } from "@/loading/lazy-named";
import { PageFallback } from "@/loading/page-skeleton";
import { NotFound } from "../not-found/not-found";
import { credentialCapabilitiesQuery } from "./upstream";

const loadPage = () => import("./machine-login-page");
const MachineLoginPage = lazyNamed(loadPage, "MachineLoginPage");

/** Served only while the broker still serves the device grant; a skeleton while that answer is out. */
export function MachineLoginRoute(): ReactNode {
  const capabilities = useQuery(credentialCapabilitiesQuery());
  // The page's code loads beside the read; a failed load fails again, shown, on mount.
  useEffect(() => {
    void loadPage().catch(() => undefined);
  }, []);
  const fault = readFailureOf(capabilities);
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
