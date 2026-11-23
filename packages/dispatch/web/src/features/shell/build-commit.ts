declare const __DISPATCH_COMMIT__: string | undefined;

const FULL_SHA = /^[0-9a-f]{40}$/;

// The commit this dashboard was built from, or undefined outside an image build.
export function buildCommit(): string | undefined {
  const commit = typeof __DISPATCH_COMMIT__ === "string" ? __DISPATCH_COMMIT__ : "";
  return FULL_SHA.test(commit) ? commit : undefined;
}
