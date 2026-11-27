import { afterEach, expect, test } from "bun:test";
import type { ConnectionCallbacks, DocumentConnection } from "@/upstream/editor/frame";

import { render, settle } from "../../../tests/react";
import { reportingSync, useSynced } from "./parts-slot";

afterEach(() => {
  document.body.replaceChildren();
});

const CALLBACKS: ConnectionCallbacks = {
  onAdmission: () => {},
  onOutsideSchema: () => {},
  onPending: () => {},
  onStatus: () => {},
  onSynced: () => {},
  schemaCreatable: 0,
  schemaVersion: 0,
};

function Synced({ artifactId }: { artifactId: string }) {
  return <p>{useSynced(artifactId) ? "synced" : "syncing"}</p>;
}

test("the parts learn when each connection's first sync completes, and upstream still hears it", () => {
  const connected: ConnectionCallbacks[] = [];
  const connect = reportingSync((_artifactId, callbacks) => {
    connected.push(callbacks);
    return {} as unknown as DocumentConnection;
  });
  let heard = 0;
  const { container } = render(<Synced artifactId="a-sync" />);

  settle(() => void connect("a-sync", { ...CALLBACKS, onSynced: () => (heard += 1) }));
  expect(container.textContent).toBe("syncing");
  settle(() => connected[0]?.onSynced());
  expect(container.textContent).toBe("synced");
  expect(heard).toBe(1);

  settle(() => void connect("a-sync", CALLBACKS));
  expect(container.textContent).toBe("syncing");
});
