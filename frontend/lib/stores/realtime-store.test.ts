import { describe, it, expect, beforeEach } from "vitest";
import { useRealtimeStore } from "./realtime-store";
import type { RealtimeQueryEvent } from "@/lib/types";

describe("Phase 5: Real-Time Store & Events", () => {
  beforeEach(() => {
    useRealtimeStore.setState({
      connectionState: "disconnected",
      events: [],
      unreadCount: 0,
      activeRunId: null,
    });
  });

  it("updates connection state", () => {
    expect(useRealtimeStore.getState().connectionState).toBe("disconnected");

    useRealtimeStore.getState().setConnectionState("connected");
    expect(useRealtimeStore.getState().connectionState).toBe("connected");

    useRealtimeStore.getState().setConnectionState("unavailable");
    expect(useRealtimeStore.getState().connectionState).toBe("unavailable");
  });

  it("records query events and increments unread count", () => {
    const event1: RealtimeQueryEvent = {
      event: "query.started",
      run_id: "run-101",
      connection_id: "conn-1",
      sql: "SELECT 1;",
      timestamp: new Date().toISOString(),
    };

    useRealtimeStore.getState().addEvent(event1);

    const state = useRealtimeStore.getState();
    expect(state.events.length).toBe(1);
    expect(state.unreadCount).toBe(1);
    expect(state.events[0].run_id).toBe("run-101");

    // Add another event
    const event2: RealtimeQueryEvent = {
      event: "query.completed",
      run_id: "run-101",
      connection_id: "conn-1",
      duration_ms: 24,
      row_count: 10,
      timestamp: new Date().toISOString(),
    };

    useRealtimeStore.getState().addEvent(event2);
    expect(useRealtimeStore.getState().events.length).toBe(2);
    expect(useRealtimeStore.getState().unreadCount).toBe(2);

    // Mark as read
    useRealtimeStore.getState().markRead();
    expect(useRealtimeStore.getState().unreadCount).toBe(0);
    expect(useRealtimeStore.getState().events.length).toBe(2);
  });

  it("caps events list to latest 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      useRealtimeStore.getState().addEvent({
        event: "query.started",
        run_id: `run-${i}`,
        connection_id: "conn-1",
        timestamp: new Date().toISOString(),
      });
    }

    const state = useRealtimeStore.getState();
    expect(state.events.length).toBe(50);
    expect(state.events[0].run_id).toBe("run-59");
  });
});
