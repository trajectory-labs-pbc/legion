import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { lazyNamed } from "@/loading/lazy-named";
import { NotFound } from "../not-found/not-found";
import { credentialCapabilitiesQuery } from "./upstream";

const MachineLoginPage = lazyNamed(() => import("./machine-login-page"), "MachineLoginPage");

/** Served only while the broker still serves the device grant; blank while that answer is out. */
export function MachineLoginRoute(): ReactNode {
  const capabilities = useQuery(credentialCapabilitiesQuery());
  if (capabilities.isPending) return null;
  return capabilities.data?.machine_code_page === true ? <MachineLoginPage /> : <NotFound />;
}
