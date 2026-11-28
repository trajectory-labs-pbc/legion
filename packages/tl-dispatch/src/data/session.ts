import { whoAmIQuery } from "@/upstream/queries";
import { useRead } from "./read";

/** The cache key of the signed-in person, for a test that seeds or reads it. */
export const sessionKey = whoAmIQuery().queryKey;

/** The signed-in person, as a read: a 401 `error` is the signed-out case. */
export function useSession() {
  return useRead(whoAmIQuery());
}
