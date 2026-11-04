import { HubConnectionBuilder } from "@microsoft/signalr";
import type { LiveMatchServerState } from "../pages/convocations/components/simulation/liveMatch.types";

export type LiveMatchConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type LiveMatchRealtimeHandlers = {
  onMatchUpdated: (state: LiveMatchServerState) => void;
  onMatchDeleted: (eventId: string) => void;
  onReconnected: () => void;
  onStatusChange: (status: LiveMatchConnectionStatus) => void;
};

export type LiveMatchRealtimeConnection = {
  joinMatch(eventId: string): Promise<void>;
  leaveMatch(eventId: string): Promise<void>;
  stop(): Promise<void>;
};

const LIVE_MATCH_HUB_PATH = "/hubs/live-match";

// Same base as the REST client (core/api/client.ts). A base ending in "/api" is the REST prefix,
// while the hub is mounted at the host root, so that suffix is dropped. An empty base yields a
// relative path, which the dev proxy forwards to the API.
function liveMatchHubUrl(): string {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").toString().replace(/\/+$/, "");
  const apiHostRoot = configuredBase.replace(/\/api$/, "");
  return `${apiHostRoot}${LIVE_MATCH_HUB_PATH}`;
}

export async function connectLiveMatch(handlers: LiveMatchRealtimeHandlers): Promise<LiveMatchRealtimeConnection> {
  const connection = new HubConnectionBuilder()
    .withUrl(liveMatchHubUrl(), {
      accessTokenFactory: () => localStorage.getItem("coachAuthToken") ?? "",
    })
    .withAutomaticReconnect()
    .build();

  // Handlers are registered before start() so messages arriving right after connect are not lost.
  connection.on("MatchUpdated", (state: LiveMatchServerState) => handlers.onMatchUpdated(state));
  connection.on("MatchDeleted", (eventId: string) => handlers.onMatchDeleted(eventId));
  connection.onreconnecting(() => handlers.onStatusChange("reconnecting"));
  connection.onreconnected(() => {
    handlers.onReconnected();
    handlers.onStatusChange("connected");
  });
  connection.onclose(() => handlers.onStatusChange("disconnected"));

  handlers.onStatusChange("connecting");
  try {
    await connection.start();
  } catch (error) {
    handlers.onStatusChange("disconnected");
    throw error;
  }
  handlers.onStatusChange("connected");

  return {
    joinMatch: async (eventId) => {
      await connection.invoke("JoinMatch", eventId);
    },
    leaveMatch: async (eventId) => {
      await connection.invoke("LeaveMatch", eventId);
    },
    stop: async () => {
      await connection.stop();
    },
  };
}
