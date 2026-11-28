// Upstream's server reads, as query options.
export {
  inboxQuery,
  issueQuery,
  myRepliesCountQuery,
  prioritiesQuery,
  prioritySummaryQuery,
  projectsQuery,
  userAgentStateQuery,
  whoAmIQuery,
} from "@upstream-dispatch/api/queries";
export { credentialCapabilitiesQuery } from "@upstream-dispatch/features/credentials/capabilities";
export { credentialGrantsQuery } from "@upstream-dispatch/features/credentials/grants";
export { machineLoginsQuery } from "@upstream-dispatch/features/credentials/machineLogins";
export { credentialPendingQuery } from "@upstream-dispatch/features/credentials/pending";
