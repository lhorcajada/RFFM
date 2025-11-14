import axios from "axios";

const BASE = (import.meta.env.VITE_API_BASE_URL || "")
  .toString()
  .replace(/\/?$/, "/");

const DEFAULT_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT ?? 60000);
const DEFAULT_RETRIES = Number(import.meta.env.VITE_API_RETRIES ?? 3);
const client = axios.create({ baseURL: BASE, timeout: DEFAULT_TIMEOUT });

export async function getPlayer(playerId: string) {
  const res = await client.get(`players/${encodeURIComponent(playerId)}`);
  return res.data;
}

import type { PlayersByTeamResponse } from "../types/player";

export async function getPlayersByTeam(
  teamId: string
): Promise<PlayersByTeamResponse> {
  const maxAttempts = DEFAULT_RETRIES;
  let attempt = 0;
  let lastErr: any = null;
  while (attempt < maxAttempts) {
    try {
      const res = await client.get(
        `players/team/${encodeURIComponent(teamId)}`
      );
      return res.data;
    } catch (err) {
      lastErr = err;
      attempt++;
      const delay = 500 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getTeamsForClassification(params: {
  season?: string;
  competition?: string;
  group?: string;
  playType?: string;
}) {
  const q = new URLSearchParams();
  if (params.season) q.append("season", params.season);
  if (params.competition) q.append("competition", params.competition);
  if (params.group) q.append("group", params.group);
  if (params.playType) q.append("playType", params.playType);
  const res = await client.get(`teams?${q.toString()}`);
  return res.data;
}

export default client;
