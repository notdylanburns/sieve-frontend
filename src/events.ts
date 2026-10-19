import { useEffect, useRef } from "react";

import { eventsUrl } from "./api";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Calls `onChange` whenever the server reports that the workspace's applications
 * may have changed, reconnecting with backoff. Changes made on this page also
 * arrive here, so `onChange` should be a quiet refresh.
 */
export function useApplicationsChanged(
  workspace: string,
  onChange: () => void,
) {
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let delay = MIN_RETRY_MS;
    let connectedBefore = false;
    let stopped = false;

    function connect() {
      socket = new WebSocket(eventsUrl(workspace));

      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as { type: string };

        if (event.type === "hello") {
          delay = MIN_RETRY_MS;
          // Anything could have changed while we were disconnected.
          if (connectedBefore) {
            callback.current();
          }
          connectedBefore = true;
        } else if (event.type === "applications_changed") {
          callback.current();
        }
      };

      socket.onclose = () => {
        if (stopped) {
          return;
        }
        retry = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, MAX_RETRY_MS);
      };
    }

    connect();

    return () => {
      stopped = true;
      window.clearTimeout(retry);
      socket?.close();
    };
  }, [workspace]);
}
