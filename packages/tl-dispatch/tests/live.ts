import type { QueryClient } from "@tanstack/react-query";

import type { DispatchEvent } from "@/upstream/contract";
import { liveSocketFor } from "@/upstream/live";
import { settle } from "./react";
import { installFakeLiveSockets } from "./upstream";

/**
 * Stands in for Dispatch's live socket from now until `stop`: `send` delivers an event on the
 * feed of the page drawn with `client`, opening that feed with nothing to replay the first time.
 */
export function fakeLive(client: QueryClient): {
  send(event: DispatchEvent): void;
  stop(): void;
} {
  const sockets = installFakeLiveSockets();
  let feed: string | undefined;
  return {
    send(event) {
      const socket = sockets.latest();
      settle(() => {
        if (feed === undefined) {
          socket.open();
          feed = socket.subscribed("events").sub;
          socket.receive({ type: "events_start", sub: feed, since: "0", replay_complete: true });
        }
        socket.receive({ type: "event", sub: feed, id: String(event.id), event });
      });
    },
    stop() {
      liveSocketFor(client).close();
      sockets.restore();
    },
  };
}
