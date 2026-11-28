import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { http } from "msw";

import { projectsQuery } from "@/upstream/queries";
import { json } from "../../tests/network";
import { answerRequests } from "../../tests/upstream";
import { prefetchOf } from "./prefetch";

describe("prefetchOf", () => {
  test("starts the read under upstream's key", async () => {
    answerRequests(http.get("/api/v1/projects", () => json([{ key: "AB", name: "Alpha" }])));
    const client = new QueryClient();
    await prefetchOf(projectsQuery()).start(client);
    expect(client.getQueryData(projectsQuery().queryKey)?.map((project) => project.key)).toEqual([
      "AB",
    ]);
  });
});
