import { useQuery } from "@tanstack/react-query";
import { lazy, type ReactNode } from "react";

import { NotFound } from "./NotFound";
import { credentialCapabilitiesQuery } from "./upstream";

const MachineLoginPage = lazy(() =>
  import("./MachineLoginPage").then((module) => ({ default: module.MachineLoginPage }))
);

/** Served only while the broker still serves the device grant; blank while that answer is out. */
export function MachineLoginRoute(): ReactNode {
  const capabilities = useQuery(credentialCapabilitiesQuery());
  if (capabilities.isPending) return null;
  return capabilities.data?.machine_code_page === true ? <MachineLoginPage /> : <NotFound />;
}
