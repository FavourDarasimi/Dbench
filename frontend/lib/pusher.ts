"use client";

import Pusher, { type Channel } from "pusher-js";
import { useRealtimeStore, type ConnectionState } from "./stores/realtime-store";
import type { RealtimeQueryEvent } from "./types";

let pusherInstance: Pusher | null = null;
let activeChannel: Channel | null = null;
let currentSubscribedUserId: string | number | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") return null;

  if (!pusherInstance) {
    const appKey = process.env.NEXT_PUBLIC_SOKETI_APP_KEY || "app-key";
    const host =
      process.env.NEXT_PUBLIC_SOKETI_HOST ||
      (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");
    const port = Number(process.env.NEXT_PUBLIC_SOKETI_PORT || 6001);
    const useTls = process.env.NEXT_PUBLIC_SOKETI_USE_TLS === "true";

    try {
      pusherInstance = new Pusher(appKey, {
        cluster: process.env.NEXT_PUBLIC_SOKETI_CLUSTER || "mt1",
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: useTls,
        disableStats: true,
        enabledTransports: ["ws", "wss"],
        authEndpoint: "/api/pusher/auth/",
        auth: {
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      });

      // Bind connection states to Zustand store
      pusherInstance.connection.bind("state_change", (states: { current: string }) => {
        const state = states.current as ConnectionState;
        useRealtimeStore.getState().setConnectionState(state);
      });

      pusherInstance.connection.bind("error", () => {
        useRealtimeStore.getState().setConnectionState("unavailable");
      });
    } catch {
      useRealtimeStore.getState().setConnectionState("unavailable");
      return null;
    }
  }

  return pusherInstance;
}

export function subscribeUserChannel(userId: string | number) {
  if (!userId || typeof window === "undefined") return;

  const client = getPusherClient();
  if (!client) return;

  if (currentSubscribedUserId === userId && activeChannel) {
    return;
  }

  // Unsubscribe old channel if user changed
  if (activeChannel && currentSubscribedUserId) {
    client.unsubscribe(`private-user-${currentSubscribedUserId}`);
    activeChannel = null;
  }

  currentSubscribedUserId = userId;
  const channelName = `private-user-${userId}`;

  try {
    const channel = client.subscribe(channelName);
    activeChannel = channel;

    // Listen for query events
    const eventTypes = [
      "query.started",
      "query.progress",
      "query.completed",
      "query.failed",
      "query.cancelled",
    ] as const;

    for (const evt of eventTypes) {
      channel.bind(evt, (data: any) => {
        const eventPayload: RealtimeQueryEvent = {
          event: evt,
          run_id: data.run_id || "",
          connection_id: data.connection_id || "",
          sql: data.sql,
          duration_ms: data.duration_ms,
          row_count: data.row_count,
          error: data.error,
          status: data.status,
          timestamp: data.timestamp || new Date().toISOString(),
        };

        useRealtimeStore.getState().addEvent(eventPayload);
      });
    }
  } catch {
    useRealtimeStore.getState().setConnectionState("unavailable");
  }
}

export function disconnectPusher() {
  if (pusherInstance) {
    if (activeChannel && currentSubscribedUserId) {
      pusherInstance.unsubscribe(`private-user-${currentSubscribedUserId}`);
      activeChannel = null;
    }
    pusherInstance.disconnect();
    pusherInstance = null;
    currentSubscribedUserId = null;
    useRealtimeStore.getState().setConnectionState("disconnected");
  }
}
