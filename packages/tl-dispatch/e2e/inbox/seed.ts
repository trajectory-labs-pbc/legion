// The records of the Inbox's browser tests: each kind of row the Inbox lists, made through
// upstream's api.ts `as: "agent"`, so a test seeds the same way in both modes (modes.ts). What
// only the person can write (an answer, a thread's root, a read mark, a snooze) goes as the
// signed-in person, with the session cookie of the test's page, as the route test reads the
// person. Each test seeds its own project, named after the run, and the `inbox` fixture undoes
// every open row it made when the test ends, so a deployed person's Inbox keeps none of them.
import { randomBytes } from "node:crypto";

import type {
  AnswerAskInput,
  AskOption,
  AskSnoozeInput,
  Comment,
  CreateCommentInput,
  InboxRow,
  ThreadReadInput,
} from "@legion/contracts";
import {
  baseUrl,
  createAsk,
  createComment,
  createIssue,
  createProject,
  dashboardOrigin,
  requestApproval,
  resolveAsk,
  withOpenedAsk,
} from "../../../dispatch/e2e/api";
import { setPendingCredentialRequests } from "../../../dispatch/e2e/fake-broker-helpers";
import { usesFakeBroker } from "../../../dispatch/e2e/harness-broker";
import { test as base, expect, type Page, runName } from "../test";

const AGENT = { as: "agent" } as const;

/** The kinds of open ask, named as the page tests' fixtures name them (tests/inbox.ts). */
const ASK_SHAPES = {
  withOptions: {
    options: [
      { description: "Release today from main.", label: "Ship" },
      { description: "Wait for the retry fix.", label: "Hold" },
    ],
  },
  oneChoice: { options: [{ label: "Staging" }, { label: "Production" }, { label: "Both" }] },
  severalChoices: {
    multiple: true,
    options: [{ label: "Linux" }, { label: "macOS" }, { label: "Windows" }],
  },
  noOptions: {},
} satisfies Record<string, { multiple?: boolean; options?: AskOption[] }>;

export type AskKind = keyof typeof ASK_SHAPES;

export interface Seeded {
  id: string;
  /** The issue the row is on. */
  issue: string;
  /** The text the row shows, which a test finds it by. */
  text: string;
}

/** A project key no other test of any run has: a letter, then nine letters or digits. */
const projectKey = () => `I${randomBytes(5).toString("hex").slice(0, 9).toUpperCase()}`;

/** One test's records, and what undoes them. */
export class InboxSeed {
  private login: Promise<string> | undefined;
  private key: Promise<string> | undefined;
  /** What undoes each record that would stay in the reader's Inbox, by the record's id. */
  private readonly cleanups = new Map<string, () => Promise<unknown>>();

  constructor(private readonly page: Page) {}

  /** A request as the signed-in person: their session cookie, and the origin a cookie write
   *  needs. */
  private async person<T>(method: string, path: string, body?: object): Promise<T> {
    const cookies = await this.page.context().cookies(baseUrl);
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

  /** The signed-in person's login. */
  reader(): Promise<string> {
    this.login ??= this.person<{ login: string }>("GET", "/auth/whoami").then((me) => me.login);
    return this.login;
  }

  /** This test's project, whose questions wait on the reader. */
  project(): Promise<string> {
    this.key ??= (async () => {
      const key = projectKey();
      const default_assignee = await this.reader();
      await createProject({ default_assignee, key, name: `${runName} inbox ${key}` }, AGENT);
      return key;
    })();
    return this.key;
  }

  /** The Inbox's address narrowed to this test's project, with `search` beside it. */
  async address(search: Record<string, string> = {}): Promise<string> {
    return `/?${new URLSearchParams({ project: await this.project(), ...search })}`;
  }

  /** An issue of this test's project, titled by the first line of `text`. `force` files it
   *  beside the issues whose titles it resembles. */
  private async issue(text: string, spec?: string) {
    const title = `${runName} ${text.split("\n", 1)[0]}`.slice(0, 200);
    return createIssue({ force: true, project: await this.project(), spec, title }, AGENT);
  }

  private retractLater(id: string): void {
    this.cleanups.set(id, () =>
      resolveAsk(id, { kind: "retracted", reason: "The test ended." }, AGENT)
    );
  }

  /** An open ask of `kind`, waiting on the reader. `agent` is the session that asks it. */
  async ask(kind: AskKind, question: string, agent?: string): Promise<Seeded> {
    const issue = await this.issue(question);
    const text = `${runName} ${question}`;
    const actor = agent === undefined ? undefined : { id: agent, kind: "session" as const };
    const ask = await createAsk(
      issue.key,
      { ...ASK_SHAPES[kind], question: text },
      { ...AGENT, actor }
    );
    this.retractLater(ask.id);
    return { id: ask.id, issue: issue.key, text };
  }

  /** `count` asks with options, the first made first. */
  async asks(count: number, question: string): Promise<Seeded[]> {
    const seeded: Seeded[] = [];
    for (let index = 1; index <= count; index += 1) {
      seeded.push(await this.ask("withOptions", `${question} ${index}?`));
    }
    return seeded;
  }

  /** A request to approve an issue's spec. */
  async approval(): Promise<Seeded> {
    const issue = await this.issue("approval", "# Rollout\n\nThe mirror moves after the ledger.\n");
    const { ask } = withOpenedAsk(
      await requestApproval(issue.primary_artifact_id, { summary: "The rollout." }, AGENT)
    );
    this.retractLater(ask.id);
    return { id: ask.id, issue: issue.key, text: ask.question };
  }

  /** A decision ask in an issue's spec, under a section of `lines` paragraphs. */
  async decisionInDocument(question: string, lines = 0): Promise<Seeded> {
    const text = `${runName} ${question}`;
    const spec = [
      "# Rollout order",
      "",
      ...Array.from({ length: lines }, (_, index) => [`Rollout note ${index + 1}.`, ""]).flat(),
      ':::ask{#rollout-order urgency="med" multiple="false" state="open"}',
      text,
      "",
      "- Ledger first",
      "- Mirror first",
      ":::",
      "",
    ].join("\n");
    const issue = await this.issue(question, spec);
    // The server opens the block's ask once it has indexed the spec.
    let row: InboxRow | undefined;
    await expect
      .poll(async () => {
        row = (await this.inbox()).find((ask) => ask.issue_key === issue.key);
        return row !== undefined;
      })
      .toBe(true);
    if (row === undefined) throw new Error(`${issue.key} opened no ask`);
    this.retractLater(row.id);
    return { id: row.id, issue: issue.key, text };
  }

  /** A thread the reader started, with `replies` from an agent; the last `unread` of them are
   *  unread. */
  async unreadThread(root: string, replies: string[], unread = replies.length): Promise<Seeded> {
    const issue = await this.issue(root);
    const text = `${runName} ${root}`;
    const head = await this.person<Comment>("POST", `/api/v1/issues/${issue.key}/comments`, {
      body: text,
    } satisfies CreateCommentInput);
    const written: Comment[] = [];
    for (const body of replies) {
      written.push(await createComment(issue.key, { body, reply_to: head.id }, AGENT));
    }
    const read = written.at(-1 - unread);
    if (read !== undefined) await this.readThread(head.id, read.created_at);
    const last = written.at(-1);
    if (last !== undefined)
      this.cleanups.set(head.id, () => this.readThread(head.id, last.created_at));
    return { id: head.id, issue: issue.key, text };
  }

  private readThread(thread: string, through: string): Promise<unknown> {
    return this.person("PUT", `/api/v1/me/threads/${thread}/read`, {
      read_through: through,
    } satisfies ThreadReadInput);
  }

  /** A pending credential request waiting on the reader. The fake broker alone lists one, so
   *  it is undefined against a server that reads none. */
  async credentialRequest(identifier: string): Promise<{ text: string } | undefined> {
    if (!usesFakeBroker) return undefined;
    const id = `${runName.toLowerCase()}-${identifier.toLowerCase()}`;
    await setPendingCredentialRequests([
      {
        approve_url: "https://secrets.example/approve",
        approver: await this.reader(),
        identifiers: [identifier],
        kind: "agent_secret",
        record_id: id,
        requested_at: new Date().toISOString(),
        session: { enrollment: null, request: null },
      },
    ]);
    return { text: identifier };
  }

  /** An ask the reader answered. */
  async answered(question: string): Promise<Seeded> {
    const issue = await this.issue(question);
    const text = `${runName} ${question}`;
    const ask = await createAsk(issue.key, { ...ASK_SHAPES.withOptions, question: text }, AGENT);
    await this.person("POST", `/api/v1/asks/${ask.id}/answer`, {
      expected_edited_at: null,
      selected: ["Ship"],
    } satisfies AnswerAskInput);
    return { id: ask.id, issue: issue.key, text };
  }

  /** The reader snoozes the ask for a day. */
  async snooze(id: string): Promise<void> {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    await this.person("PUT", `/api/v1/me/asks/${id}/snooze`, {
      snoozed_until: until,
    } satisfies AskSnoozeInput);
  }

  /** The agent withdraws the ask, as a row that leaves the Inbox while the reader looks. */
  async retract(id: string): Promise<void> {
    this.cleanups.delete(id);
    await resolveAsk(id, { kind: "retracted", reason: "Withdrawn by the test." }, AGENT);
  }

  /** The reader's open asks, as the Inbox reads them. */
  inbox(): Promise<InboxRow[]> {
    return this.person("GET", "/api/v1/inbox");
  }

  /** Undoes each record that would stay in the reader's Inbox; each on its own, so one that
   *  fails leaves none of the others undone. */
  async cleanUp(): Promise<void> {
    const results = await Promise.allSettled([...this.cleanups.values()].map((undo) => undo()));
    const failed = results.flatMap((result) =>
      result.status === "rejected" ? [String(result.reason)] : []
    );
    expect.soft(failed, "cleanups that failed").toEqual([]);
  }
}

/** The harness's `test`, with the test's own `inbox` seed. */
export const test = base.extend<{ inbox: InboxSeed }>({
  inbox: async ({ page }, use) => {
    const seed = new InboxSeed(page);
    await use(seed);
    await seed.cleanUp();
  },
});

export { expect, type Page } from "../test";
