import { describe, expect, test } from "bun:test";

import type { InboxRow } from "@/upstream/contract";
import { INBOX_ASKS, UNREAD_THREAD } from "../../../tests/inbox";
import { rowFacts, rowText } from "./row";

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

  test("a row's priority carries the Filter's word for it", () => {
    const of = (priority: InboxRow["priority"]) =>
      rowFacts({ kind: "ask", ask: { ...INBOX_ASKS.withOptions, priority } }).priority;
    expect(of(1)).toEqual({ value: 1, label: "P1" });
    expect(of(null)).toEqual({ value: null, label: "No priority" });
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

describe("a row's words", () => {
  test("an ask shows its issue on line one and the question's first line on line two", () => {
    const ask = { ...INBOX_ASKS.withOptions, question: "\n  Which release path?\nMore." };
    expect(rowText({ kind: "ask", ask })).toEqual({
      owner: "CORE-1",
      title: "Release train",
      preview: "Which release path?",
    });
    const { issue: _issue, ...onKeyOnly } = ask;
    // A read without the issue object still names its issue by key, as upstream's rows do.
    expect(rowText({ kind: "ask", ask: onKeyOnly }).owner).toBe("CORE-1");
    const onNothing = { ...onKeyOnly, issue_key: null };
    expect(rowText({ kind: "ask", ask: onNothing })).toEqual({
      owner: undefined,
      title: "Which release path?",
      preview: "",
    });
  });

  test("a thread shows its owner and subject, then the last writer and the newest line", () => {
    expect(rowText({ kind: "thread", thread: UNREAD_THREAD })).toEqual({
      owner: "CORE-1",
      title: "Root",
      preview: "Agent: Done.",
    });
    const person = { ...UNREAD_THREAD.reply, author: { kind: "user", id: "ana@example.com" } };
    expect(rowText({ kind: "thread", thread: { ...UNREAD_THREAD, reply: person } }).preview).toBe(
      "ana@example.com: Done."
    );
  });
});
