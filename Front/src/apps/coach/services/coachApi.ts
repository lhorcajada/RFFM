import client from "../../../core/api/client";

export interface AcquireTrialResult {
  roles?: string[];
  token?: string;
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

export default { acquireCoachTrial, getMyRoles };
