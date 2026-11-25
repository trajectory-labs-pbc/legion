---
name: react-quality
description: "Use when you write or review TypeScript or React code in packages/tl-dispatch or packages/ui: the code bar for casts, refs, context values, typed maps, comments and parity tests, each rule with a bad and a good example."
---

# The code bar

Each rule below holds for every file this repository adds under `packages/tl-dispatch` and `packages/ui`. A reviewer blocks a change that breaks one. Upstream's own files keep upstream's rules.

## 1. No casts

A cast tells the type check to stop checking. Use a type guard, `satisfies`, a generic, or a typed parser at the boundary. This covers `as T`, `as unknown as T`, the non-null `!`, and `// @ts-ignore`. `as const` is not a cast.

```ts
// Bad
const params = match.params as { key: string };
const row = rows.find(isOpen)!;

// Good
if (!isParamsOf(page.path, match.params)) throw new Error(`the address is not on ${page.path}`);
const row = rows.find(isOpen);
if (row === undefined) return null;
```

## 2. No ref writes during render

Render must be pure: React may render twice or throw a render away. Write a ref in an effect or an event handler, never in the component body.

```tsx
// Bad
const latest = useRef(onSave);
latest.current = onSave;

// Good
const latest = useRef(onSave);
useLayoutEffect(() => {
  latest.current = onSave;
});
```

## 3. No state mirrored in refs

A value that render shows lives in state, or is derived from props and state during render. A ref holds only what render never reads: a DOM node, a timer, the latest callback for a subscription. A ref copy of state goes stale and hides an update.

```tsx
// Bad
const [open, setOpen] = useState(false);
const openRef = useRef(open);
useEffect(() => {
  openRef.current = open;
}, [open]);
const toggle = useCallback(() => setOpen(!openRef.current), []);

// Good
const [open, setOpen] = useState(false);
const toggle = useCallback(() => setOpen((current) => !current), []);
```

## 4. Stable context values

A provider whose `value` is a new object on each render re-renders every consumer on each render. Memoize the value, or provide a value that is already stable (a store, a setter).

```tsx
// Bad
<LayoutContext.Provider value={{ sidebar, setSidebar }}>{children}</LayoutContext.Provider>

// Good
const value = useMemo(() => ({ sidebar, setSidebar }), [sidebar]);
<LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
```

## 5. Typed maps over Object.fromEntries

`Object.fromEntries` returns `{ [key: string]: T }`: the key type is lost, and a missing key reads as `T`. Write the map as a literal checked with `satisfies Record<Key, T>`, or use a `Map` and handle the missing key.

```ts
// Bad
const PAGES = Object.fromEntries(NAV_DESTINATIONS.map((d) => [d.name, routeOf(d)]));

// Good
export const NAV_PAGES = {
  inbox: inbox.routes.home,
  agents: agents.routes.list,
} as const satisfies Readonly<Record<NavName, PageRoute>>;

const byName = new Map(list.map((spec) => [spec.command.name, spec]));
const spec = byName.get(name);
if (spec === undefined) throw new Error(`no command "${name}"`);
```

## 6. Thin comments that never cite issue numbers

A comment says why the code is as it is, in one short line where possible. It never restates the code, never tells history, and never cites an issue, a pull request or a tracker key: those belong in the commit message.

```ts
// Bad
// Fixes #412: we used to read the label here, which broke the sheet (see ABC-123).
// Loop over the bindings and register each one.

// Good
// The engine copies a binding's label when it registers, so a new label registers again.
```

## 7. Tests that name parity IDs

A rebuilt page keeps everything upstream's page did. Each action, key, URL form, view state and live update of the page has a parity ID: a short prefix for the view it covers, and a number (`MLP-01`). Its test name starts with the ID, so a reviewer can match the parity list to the tests with one search.

```ts
// Bad
test("works", async () => { ... });

// Good
test("MLP-01 code -> lookup -> Approve posts the looked-up code", async () => { ... });
test("MLP-02 a refused lookup shows the server's reason under the field", async () => { ... });
```

A port of an upstream test keeps upstream's assertion and adds the ID. A new parity item gets the next free number for its prefix.

## Checks

- `bun run typecheck` and `bun run lint` (Biome) in the package. A `biome-ignore` needs a reason after the colon that names what stands in for the rule.
- A reviewer reads the diff for each rule above and cites its number.
