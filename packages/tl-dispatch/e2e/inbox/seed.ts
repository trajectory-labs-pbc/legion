// The records of the Inbox's browser tests: each kind of row the Inbox lists, made through
// upstream's api.ts `as: "agent"`, so a test seeds the same way in both modes (modes.ts). What
// only the person can write (an answer, a thread's root, a read mark, a snooze, a dismissal) goes
// as the signed-in person (person.ts). Each test seeds its own project, named after the run.
// When the test ends the `inbox` fixture closes the project's issues, which withdraws their open
// asks, and dismisses its threads, so a deployed person's Inbox keeps none of its rows. What
// stays is the project, its closed issues, the answers and the thread roots in the person's name.
import { randomBytes } from "node:crypto";

import type {
  AnswerAskInput,
  AskOption,
  AskSnoozeInput,
  Comment,
  CreateCommentInput,
  InboxDismissRequest,
  InboxRow,
  ThreadReadInput,
} from "@legion/contracts";
import {
  createAsk,
  createComment,
  createIssue,
  createProject,
  patchIssue,
  requestApproval,
  resolveAsk,
  withOpenedAsk,
} from "../../../dispatch/e2e/api";
import { setPendingCredentialRequests } from "../../../dispatch/e2e/fake-broker-helpers";
import { usesFakeBroker } from "../../../dispatch/e2e/harness-broker";
import {
  DECISION_BLOCK,
  DECISION_QUESTION,
  SECTION_HEADING,
} from "../../../dispatch/e2e/inbox-reading-pane";
import { asPerson } from "../person";
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
  /** An ask's row or a thread's, which the page names differently (page.ts). */
  kind: "ask" | "thread";
  /** The text the row shows. */
  text: string;
}

/** A project key no other test of any run has: a letter, then nine letters or digits. */
const projectKey = () => `I${randomBytes(5).toString("hex").slice(0, 9).toUpperCase()}`;

/** One test's records, and what undoes them. */
export class InboxSeed {
  private login: Promise<string> | undefined;
  private key: Promise<string> | undefined;
  /** The issues this test made, which its end closes. */
  private readonly issues = new Set<string>();
  /** The newest reply of each thread this test made, which its end dismisses through. */
  private readonly threads = new Set<string>();

  constructor(private readonly page: Page) {}

  private person<T>(method: string, path: string, body?: object): Promise<T> {
    return asPerson(this.page, method, path, body);
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
   *  beside the project's issues whose titles it resembles. */
  private async issue(text: string, options: { force?: boolean; spec?: string } = {}) {
    const title = `${runName} ${text.split("\n", 1)[0]}`.slice(0, 200);
    const issue = await createIssue({ project: await this.project(), title, ...options }, AGENT);
    this.issues.add(issue.key);
    return issue;
  }

  /** An open ask of `kind` on `issue`, waiting on the reader. `agent` is the session that asks
   *  it. */
  private async askOn(
    issue: string,
    kind: AskKind,
    question: string,
    agent?: string
  ): Promise<Seeded> {
    const text = `${runName} ${question}`;
    const actor = agent === undefined ? undefined : { id: agent, kind: "session" as const };
    const ask = await createAsk(
      issue,
      { ...ASK_SHAPES[kind], question: text },
      { ...AGENT, actor }
    );
    return { id: ask.id, issue, kind: "ask", text };
  }

  /** An open ask of `kind` on an issue of its own. */
  async ask(kind: AskKind, question: string, agent?: string): Promise<Seeded> {
    const issue = await this.issue(question, { force: true });
    return this.askOn(issue.key, kind, question, agent);
  }

  /** `count` asks with options on one issue, the first made first. */
  async asks(count: number, question: string): Promise<Seeded[]> {
    const issue = await this.issue(question);
    const seeded: Seeded[] = [];
    for (let index = 1; index <= count; index += 1) {
      seeded.push(await this.askOn(issue.key, "withOptions", `${question} ${index}?`));
    }
    return seeded;
  }

  /** A request to approve an issue's spec. */
  async approval(): Promise<Seeded> {
    const issue = await this.issue("approval", {
      force: true,
      spec: "# Rollout\n\nThe mirror moves after the ledger.\n",
    });
    const { ask } = withOpenedAsk(
      await requestApproval(
        issue.primary_artifact_id,
        { summary: `${runName} The rollout.` },
        AGENT
      )
    );
    return { id: ask.id, issue: issue.key, kind: "ask", text: ask.question };
  }

  /** Upstream's decision ask in an issue's spec, under a section of `lines` paragraphs. */
  async decisionInDocument(lines = 0): Promise<Seeded> {
    const text = `${runName} ${DECISION_QUESTION}`;
    const spec = [
      `# ${SECTION_HEADING}`,
      "",
      ...Array.from({ length: lines }, (_, index) => [`Rollout note ${index + 1}.`, ""]).flat(),
      `:::ask{#${DECISION_BLOCK} urgency="med" multiple="false" state="open"}`,
      text,
      "",
      "- Ledger first",
      "- Mirror first",
      ":::",
      "",
    ].join("\n");
    const issue = await this.issue(DECISION_QUESTION, { force: true, spec });
    // The server opens the block's ask once it has indexed the spec.
    let row: InboxRow | undefined;
    await expect
      .poll(async () => {
        const rows = await this.person<InboxRow[]>("GET", "/api/v1/inbox");
        row = rows.find((ask) => ask.issue_key === issue.key);
        return row !== undefined;
      })
      .toBe(true);
    if (row === undefined) throw new Error(`${issue.key} opened no ask`);
    return { id: row.id, issue: issue.key, kind: "ask", text };
  }

  /** A thread the reader started, with `replies` from an agent, the newest of them unread. */
  async unreadThread(root: string, replies: string[]): Promise<Seeded> {
    const issue = await this.issue(root, { force: true });
    const text = `${runName} ${root}`;
    const head = await this.person<Comment>("POST", `/api/v1/issues/${issue.key}/comments`, {
      body: text,
    } satisfies CreateCommentInput);
    const written: Comment[] = [];
    for (const body of replies) {
      written.push(await createComment(issue.key, { body, reply_to: head.id }, AGENT));
    }
    const read = written.at(-2);
    if (read !== undefined) {
      await this.person("PUT", `/api/v1/me/threads/${head.id}/read`, {
        read_through: read.created_at,
      } satisfies ThreadReadInput);
    }
    const newest = written.at(-1);
    if (newest !== undefined) this.threads.add(newest.created_at);
    return { id: head.id, issue: issue.key, kind: "thread", text };
  }

  /** Lists a pending credential request waiting on the reader. Only the fake broker lists one,
   *  so it answers whether it did. */
  async credentialRequest(identifier: string): Promise<boolean> {
    if (!usesFakeBroker) return false;
    await setPendingCredentialRequests([
      {
        approve_url: "https://secrets.example/approve",
        approver: await this.reader(),
        identifiers: [identifier],
        kind: "agent_secret",
        record_id: `${runName.toLowerCase()}-${identifier.toLowerCase()}`,
        requested_at: new Date().toISOString(),
        session: { enrollment: null, request: null },
      },
    ]);
    return true;
  }

  /** An ask the reader answered. */
  async answered(question: string): Promise<Seeded> {
    const issue = await this.issue(question, { force: true });
    const seeded = await this.askOn(issue.key, "withOptions", question);
    await this.person("POST", `/api/v1/asks/${seeded.id}/answer`, {
      expected_edited_at: null,
      selected: ["Ship"],
    } satisfies AnswerAskInput);
    return seeded;
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
    await resolveAsk(id, { kind: "retracted", reason: "Withdrawn by the test." }, AGENT);
  }

  /** Closes the test's issues and dismisses its threads, each on its own, so one that fails
   *  leaves none of the others undone. */
  async cleanUp(): Promise<void> {
    const project = this.key === undefined ? [] : [await this.key];
    const results = await Promise.allSettled([
      ...[...this.issues].map((key) => patchIssue(key, { status: "done" }, AGENT)),
      ...[...this.threads].map((through) =>
        this.person("POST", "/api/v1/me/inbox/dismiss", {
          dismiss_through: through,
          project,
        } satisfies InboxDismissRequest)
      ),
    ]);
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

export { expect } from "../test";
