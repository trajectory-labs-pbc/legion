import { describe, expect, test } from "bun:test";
import { PageFallback } from "@/loading/page-skeleton";

import { IssueFrameFallback, IssuePageFallback } from "./page-fallbacks";
import { pageFallbackOf } from "./use-shell-layout";

describe("pageFallbackOf", () => {
  test("SHL-43 the issue frame loads in its outline, an issue page in its tabs, any other page with no tabs", () => {
    expect(pageFallbackOf(true, "AB-1")).toBe(IssueFrameFallback);
    expect(pageFallbackOf(false, "AB-1")).toBe(IssuePageFallback);
    expect(pageFallbackOf(false, undefined)).toBe(PageFallback);
  });
});
