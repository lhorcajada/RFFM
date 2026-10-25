import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import configurationCoachService from "../services/configurationCoachService";

export const TEAM_NAV_TEAM_ID_KEY = "coach_nav_teamId";
const PLAYER_TEAM_ID_KEY = "coach_player_teamId";

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage may be blocked (private mode); the URL value is still used.
  }
}

function resolveSyncTeamId(search: string, isPlayer: boolean): string | null {
  const fromUrl = new URLSearchParams(search).get("teamId");
  if (fromUrl) return fromUrl;
  const fromSession = readStorage(() => sessionStorage, TEAM_NAV_TEAM_ID_KEY);
  if (fromSession) return fromSession;
  return isPlayer ? readStorage(() => localStorage, PLAYER_TEAM_ID_KEY) : null;
}

/**
 * Team the Coach team navigation links point to, so pages without `teamId`
 * in the URL (news, lottery, rivals…) keep the team in context. Order: URL,
 * last team seen in this session, the player's linked team, the coach's
 * preferred team.
 */
export function useTeamContextId(isPlayer: boolean): string | null {
  const { search } = useLocation();
  const syncTeamId = resolveSyncTeamId(search, isPlayer);
  const [preferredTeamId, setPreferredTeamId] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = new URLSearchParams(search).get("teamId");
    if (fromUrl) writeStorage(() => sessionStorage, TEAM_NAV_TEAM_ID_KEY, fromUrl);
  }, [search]);

  useEffect(() => {
    if (syncTeamId || isPlayer) return;
    let cancelled = false;
    configurationCoachService
      .getCurrent()
      .then((current) => {
        if (!cancelled) setPreferredTeamId(current?.preferredTeamId ?? null);
      })
      .catch(() => {
        if (!cancelled) setPreferredTeamId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [syncTeamId, isPlayer]);

  return syncTeamId ?? preferredTeamId;
}
