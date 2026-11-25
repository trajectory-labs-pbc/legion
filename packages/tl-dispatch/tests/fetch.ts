/** Answers the page's requests by URL for one test; an unanswered request never settles. */
export function stubFetch(answer: (url: string) => Response | undefined): {
  asked: string[];
  restore(): void;
} {
  const real = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL) => {
      const url = String(input);
      asked.push(url);
      const response = answer(url);
      return response === undefined ? new Promise<Response>(() => {}) : Promise.resolve(response);
    },
    { preconnect: real.preconnect }
  );
  return {
    asked,
    restore() {
      globalThis.fetch = real;
    },
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Waits, a step at a time, until `done` holds or a second passes. */
export async function waitFor(done: () => boolean, settle: (ms: number) => Promise<void>) {
  for (let tries = 0; tries < 20 && !done(); tries += 1) await settle(50);
}
