"use client";

import { create } from "zustand";
import type { RealtimeQueryEvent } from "@/lib/types";

export type ConnectionState = "connected" | "connecting" | "unavailable" | "disconnected";

interface RealtimeState {
  connectionState: ConnectionState;
  events: RealtimeQueryEvent[];
  unreadCount: number;
  activeRunId: string | null;

  setConnectionState: (state: ConnectionState) => void;
  addEvent: (event: RealtimeQueryEvent) => void;
  clearEvents: () => void;
  markRead: () => void;
  setActiveRunId: (runId: string | null) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionState: "disconnected",
  events: [],
  unreadCount: 0,
  activeRunId: null,

  setConnectionState: (state) => set({ connectionState: state }),

  addEvent: (event) =>
    set((s) => ({
      events: [event, ...s.events].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),

  clearEvents: () => set({ events: [], unreadCount: 0 }),

  markRead: () => set({ unreadCount: 0 }),

  setActiveRunId: (runId) => set({ activeRunId: runId }),
}));
