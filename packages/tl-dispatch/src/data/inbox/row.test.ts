import { describe, expect, test } from "bun:test";

import type { InboxRow } from "@/upstream/contract";
import { INBOX_ASKS, UNREAD_THREAD } from "../../../tests/inbox";
import { rowFacts } from "./row";

describe("a row's facts", () => {
  test("an ask has its urgency and its agent, and no unread mark", () => {
    const facts = rowFacts({ kind: "ask", ask: { ...INBOX_ASKS.withOptions, urgency: "high" } });
    expect(facts).toMatchObject({
      kind: "ask",
      type: "question",
      kindLabel: "Question",
      actor: { agent: true },
      urgency: { value: "high", label: "High" },
    });
    expect("unread" in facts).toBe(false);
    expect(facts.at.toISOString()).toBe(new Date(INBOX_ASKS.withOptions.created_at).toISOString());
  });

  test("an ask with a reply shows the reply's writer beside the reply's time", () => {
    const at = "2026-11-20T11:55:00Z";
    const ask: InboxRow = {
      ...INBOX_ASKS.withOptions,
      last_reply: { author: { kind: "user", id: "ana@example.com" }, created_at: at },
    };
    const facts = rowFacts({ kind: "ask", ask });
    expect(facts.actor).toEqual({ agent: false, id: "ana@example.com" });
    expect(facts.at.toISOString()).toBe(new Date(at).toISOString());
  });

  test("a thread has its unread mark and its author, and no urgency", () => {
    const facts = rowFacts({ kind: "thread", thread: UNREAD_THREAD });
    expect(facts).toMatchObject({ kind: "thread", unread: true, kindLabel: "Reply" });
    expect(facts.actor).toEqual({ agent: true });
    expect("urgency" in facts).toBe(false);
    const person = { ...UNREAD_THREAD.reply, author: { kind: "user", id: "ana@example.com" } };
    expect(rowFacts({ kind: "thread", thread: { ...UNREAD_THREAD, reply: person } }).actor).toEqual(
      {
        agent: false,
        id: "ana@example.com",
      }
    );
  });
});
