import { describe, expect, test } from "bun:test";
import { createCommandStore } from "./hooks";
import { type CommandSpec, createCatalog } from "./schema";

const catalog = createCatalog([
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [{ name: "create", label: "Create issue", keys: ["c"] }],
  },
]);

function spec(fired: string[], enabled = true, label = "Create issue"): CommandSpec {
  return {
    command: catalog.command("global.create"),
    label,
    enabled,
    run: () => fired.push(label),
  };
}

describe("the command store", () => {
  test("runs the last update's spec, through its gate", () => {
    const store = createCommandStore();
    const fired: string[] = [];
    store.register(spec(fired));
    store.update(spec(fired, true, "New issue"));
    expect(store.run("global.create")).toBe(true);
    store.update(spec(fired, false));
    expect(store.run("global.create")).toBe(false);
    expect(fired).toEqual(["New issue"]);
  });

  test("keeps one view until the label or the gate moves", () => {
    const store = createCommandStore();
    const fired: string[] = [];
    store.register(spec(fired));
    const first = store.view("global.create");
    store.update(spec(fired));
    expect(store.view("global.create")).toBe(first);
    store.update(spec(fired, false));
    expect(store.view("global.create")?.enabled).toBe(false);
  });

  test("refuses a second holder of one id, and an unmounted run", () => {
    const store = createCommandStore();
    const release = store.register(spec([]));
    expect(() => store.register(spec([]))).toThrow('command "global.create" is already mounted');
    release();
    expect(store.view("global.create")).toBeUndefined();
    expect(() => store.run("global.create")).toThrow("is not mounted");
  });
});
