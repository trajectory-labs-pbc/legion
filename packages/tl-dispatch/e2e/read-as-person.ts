import { baseUrl } from "../../dispatch/e2e/api";
import type { Page } from "./test";

/** A read as the signed-in person, through this worker's fetch, which the deployed mode guards
 *  (test.ts). */
export async function readAsPerson<T>(page: Page, path: string): Promise<T> {
  const cookies = await page.context().cookies(baseUrl);
  const Cookie = cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
  const response = await fetch(new URL(path, baseUrl), { headers: { Cookie } });
  if (!response.ok)
    throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

/** The signed-in person's login. */
export const signedInLogin = async (page: Page): Promise<string> =>
  (await readAsPerson<{ login: string }>(page, "/auth/whoami")).login;
