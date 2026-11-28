// A request as the signed-in person: the session cookie of a test's page, and the origin a
// cookie write needs. It goes through the worker's fetch, which the deployed mode guards
// (test.ts).
import { baseUrl, dashboardOrigin } from "../../dispatch/e2e/api";
import type { Page } from "./test";

export async function asPerson<T>(
  page: Page,
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const cookies = await page.context().cookies(baseUrl);
  const response = await fetch(new URL(path, baseUrl), {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join("; "),
      Origin: dashboardOrigin,
    },
    method,
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
