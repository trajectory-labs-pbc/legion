import { expect, test } from "bun:test";
import type { AgentState } from "@upstream-dispatch/features/refs/agent-registry";

import {
  type ProgressAgents,
  type ProgressAsk,
  type ProgressIssue,
  progressModel,
} from "./progress-model";

const NOW = Date.parse("2026-03-11T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const ISSUES = 50_000;
const TREES = 5_000;
const DEEPEST = 32;
const CHAIN_EVERY = 100;
const STATUSES = ["todo", "backlog", "in_progress", "testing", "needs_review", "retro", "done"];
const SESSIONS = 200;

/** A seeded generator, so every run builds the same data. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate() {
  const next = random(7);
  const pick = <T>(items: readonly T[]): T => {
    const item = items[Math.floor(next() * items.length)];
    if (item === undefined) throw new Error("picked from an empty list");
    return item;
  };
  const issues: ProgressIssue[] = [];
  const asks: ProgressAsk[] = [];
  const add = (parent: string | null) => {
    const key = `ALPHA-${issues.length + 1}`;
    const status = pick(STATUSES);
    const created = NOW - (30 + next() * 60) * DAY;
    const claimed = next() < 0.1;
    issues.push({
      key,
      project: "ALPHA",
      parent,
      status,
      title: `Title of ${key}`,
      assignee: "ada@example.test",
      priority: null,
      claim: claimed
        ? {
            actor: { id: `claude-code:s${Math.floor(next() * SESSIONS)}`, kind: "session" },
            at: new Date(created).toISOString(),
          }
        : null,
      created_at: new Date(created).toISOString(),
      updated_at: new Date(NOW - next() * 30 * DAY).toISOString(),
      closed_at: status === "done" ? new Date(NOW - next() * 20 * DAY).toISOString() : null,
      advances: null,
    });
    if (next() < 0.05) {
      asks.push({
        id: `ask-${asks.length}`,
        ref: `dispatch://ask/${asks.length}`,
        created_at: new Date(NOW - next() * 10 * DAY).toISOString(),
        urgency: "med",
        waiting_on: next() < 0.9 ? "human" : "agent",
        waiting_on_person: "ada@example.test",
        owner: { issue: { key, title: `Title of ${key}`, assignee: null } },
      });
    }
    return key;
  };
  const chains = TREES / CHAIN_EVERY;
  const spread = ISSUES - chains * DEEPEST;
  const others = TREES - chains;
  for (let tree = 0; tree < TREES; tree += 1) {
    const members = [add(null)];
    if (tree % CHAIN_EVERY === 0) {
      for (let depth = 1; depth < DEEPEST; depth += 1)
        members.push(add(members[depth - 1] ?? null));
      continue;
    }
    const otherIndex = tree - Math.ceil(tree / CHAIN_EVERY);
    const size = Math.floor(spread / others) + (otherIndex < spread % others ? 1 : 0);
    while (members.length < size) members.push(add(pick(members)));
  }
  const titles = new Map<string, string>();
  for (let n = 0; n < SESSIONS; n += 2)
    titles.set(`s${n}`, `Legion implementer · ${pick(issues).key}`);
  const agents: ProgressAgents = {
    known: true,
    state: (id): AgentState => (Number(id.slice(1)) % 4 === 0 ? "not-running" : "running"),
    titles,
  };
  return { issues, asks, agents };
}

test("the model computes every figure for 50,000 issues in 5,000 trees in less than 0.5 s", () => {
  const input = generate();
  expect(input.issues).toHaveLength(ISSUES);

  const started = performance.now();
  const model = progressModel(input, NOW);
  const took = performance.now() - started;

  expect(model.index.roots).toHaveLength(TREES);
  expect(model.figures.get("ALPHA-1")?.descendants).toBe(DEEPEST - 1);
  for (const figures of model.figures.values()) expect(figures.agents).not.toBeNull();
  expect(took).toBeLessThan(500);
});
