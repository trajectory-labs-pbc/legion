import { describe, expect, test } from "bun:test";

import type { CredentialPendingResponse, CredentialPendingRow } from "@/upstream/contract";
import { PENDING_CREDENTIAL_REQUEST } from "../../../tests/inbox";
import type { Read } from "../read";
import { credentialsHoldEmptyList } from "./empty-list";

const ready = (
  pending: CredentialPendingResponse["pending"]
): Read<CredentialPendingResponse | null> => ({
  state: "ready",
  data: { pending },
  refreshError: undefined,
});
const expired: CredentialPendingRow = { ...PENDING_CREDENTIAL_REQUEST, state: "expired" };

describe("the credential requests and the empty list", () => {
  test("INB-34 a list that loads, failed or waits on a decision holds the empty list", () => {
    expect(credentialsHoldEmptyList({ state: "loading" })).toBe(true);
    expect(
      credentialsHoldEmptyList({
        state: "error",
        error: new Error("down"),
        retrying: false,
        retry: () => {},
      })
    ).toBe(true);
    expect(credentialsHoldEmptyList(ready([expired, PENDING_CREDENTIAL_REQUEST]))).toBe(true);
  });

  test("INB-34 no broker, no request or only expired ones let the list say it is empty", () => {
    expect(credentialsHoldEmptyList({ state: "ready", data: null, refreshError: undefined })).toBe(
      false
    );
    expect(credentialsHoldEmptyList(ready(null))).toBe(false);
    expect(credentialsHoldEmptyList(ready([expired]))).toBe(false);
  });
});
