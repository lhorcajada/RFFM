import client from "../../../core/api/client";

const PREFERENCE_URL = "/api/match-result-notifications/preference";

export type MatchResultNotificationPreference = {
  enabled: boolean;
  teamName: string | null;
};

export async function getMatchResultNotificationPreference(): Promise<MatchResultNotificationPreference> {
  const resp = await client.get<MatchResultNotificationPreference>(PREFERENCE_URL);
  return resp.data;
}

export async function setMatchResultNotificationPreference(enabled: boolean): Promise<void> {
  await client.put(PREFERENCE_URL, { enabled });
}

export default {
  getMatchResultNotificationPreference,
  setMatchResultNotificationPreference,
};
