import client from "../../../core/api/client";

export interface AcquireTrialResult {
  roles?: string[];
  token?: string;
}

export interface MyProfile {
  roleName: string;
  playerId?: string | null;
  teamId?: string | null;
}

export async function acquireCoachTrial(
  tempToken?: string
): Promise<AcquireTrialResult> {
  // Endpoint: POST /api/coach/roles/acquire-trial
  const headers: Record<string, string> = {};
  if (tempToken) headers["X-Frontend-Temp-Token"] = tempToken;
  const resp = await client.post("/api/coach/roles/acquire-trial", null, {
    headers,
  });
  return resp.data ?? {};
}

export async function getMyRoles(): Promise<string[]> {
  const resp = await client.get<string[]>("/api/users/me/roles");
  return resp.data ?? [];
}

/** Returns the saved app profile for the current user, or null if none. */
export async function getMyProfile(): Promise<MyProfile | null> {
  try {
    const resp = await client.get<MyProfile>("/api/users/me/profile");
    return resp.data ?? null;
  } catch {
    return null;
  }
}

export default { acquireCoachTrial, getMyRoles, getMyProfile };
