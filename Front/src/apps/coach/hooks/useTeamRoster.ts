import { useEffect, useMemo, useState } from "react";
import teamplayerService, { type PlayerResponse } from "../services/teamplayerService";

/**
 * Module-level roster cache shared across every component instance in the
 * page. Several read-only tactical board previews can render on the same
 * page (one per exercise card) — without this cache each one would fire its
 * own `getPlayersByTeam` request for the same team.
 */
const rosterCache = new Map<string, PlayerResponse[]>();
const rosterPromises = new Map<string, Promise<PlayerResponse[]>>();
const listeners = new Map<string, Set<() => void>>();

function notify(teamId: string) {
  listeners.get(teamId)?.forEach((cb) => cb());
}

function fetchRoster(teamId: string): Promise<PlayerResponse[]> {
  const cached = rosterCache.get(teamId);
  if (cached) return Promise.resolve(cached);

  const inFlight = rosterPromises.get(teamId);
  if (inFlight) return inFlight;

  const promise = teamplayerService
    .getPlayersByTeam(teamId)
    .then((players) => {
      rosterCache.set(teamId, players);
      rosterPromises.delete(teamId);
      notify(teamId);
      return players;
    })
    .catch((err) => {
      rosterPromises.delete(teamId);
      throw err;
    });

  rosterPromises.set(teamId, promise);
  return promise;
}

export type TeamRoster = {
  players: PlayerResponse[];
  playersById: Map<string, PlayerResponse>;
  loading: boolean;
};

/**
 * Loads (and caches) the roster of a team, shared across every consumer of
 * this hook that requests the same `teamId` during the lifetime of the page.
 */
export function useTeamRoster(teamId?: string | null): TeamRoster {
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!teamId) return;
    const key = teamId;

    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    const onChange = () => forceRender((n) => n + 1);
    set.add(onChange);

    if (!rosterCache.has(key)) {
      fetchRoster(key).catch(() => {
        // Swallowed: consumers fall back to anonymous dorsal/alias when the
        // roster can't be resolved.
      });
    }

    return () => {
      listeners.get(key)?.delete(onChange);
    };
  }, [teamId]);

  const players = teamId ? rosterCache.get(teamId) ?? [] : [];

  const playersById = useMemo(() => {
    const map = new Map<string, PlayerResponse>();
    players.forEach((player) => {
      if (player.id) map.set(player.id, player);
    });
    return map;
  }, [players]);

  return {
    players,
    playersById,
    loading: !!teamId && !rosterCache.has(teamId),
  };
}

/** Test-only helper to reset the shared cache between test cases. */
export function __resetTeamRosterCacheForTests() {
  rosterCache.clear();
  rosterPromises.clear();
  listeners.clear();
}
