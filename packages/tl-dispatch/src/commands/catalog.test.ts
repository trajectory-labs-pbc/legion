import { describe, expect, test } from "bun:test";

import { appCatalog, type CommandId } from "./app-catalog";
import type { CommandButtonProps } from "./command-button";

describe("command ids", () => {
  test("are typed from the catalog: a typo fails the type check", () => {
    const good: CommandId = "global.create";
    // @ts-expect-error a misspelt command
    const typo: CommandId = "global.crate";
    // @ts-expect-error a command of no context
    const nowhere: CommandButtonProps["commandId"] = "page.create";
    expect(appCatalog.find(good)).toBeDefined();
    expect(appCatalog.find(typo)).toBeUndefined();
    expect(appCatalog.find(nowhere)).toBeUndefined();
  });
});
