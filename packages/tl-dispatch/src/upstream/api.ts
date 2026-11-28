// Upstream's API client and its query client.

export { NO_ROUTE_ROLLING_RELEASE_MESSAGE } from "@legion/contracts";
export type { WriteBounds } from "@upstream-dispatch/api/client";
export {
  ApiError,
  api,
  apiErrorMessage,
  isNoIdentity,
  isUnauthorized,
  NetworkError,
  RequestTimeoutError,
} from "@upstream-dispatch/api/client";
export {
  askSignInAgain,
  DispatchQueryClient,
  queryRetry,
  queryRetryDelay,
  replaceQueryData,
} from "@upstream-dispatch/api/query-client";
