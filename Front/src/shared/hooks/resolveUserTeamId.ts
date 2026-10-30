import { getMyProfile } from "../../apps/coach/services/coachApi";
import configurationCoachService from "../../apps/coach/services/configurationCoachService";

/** Team of the current user: profile teamId (Player/FamilyMember) or, failing that,
 * the coach's preferred team. Resolves to null when neither is available. */
export default async function resolveUserTeamId(): Promise<string | null> {
  try {
    const profile = await getMyProfile();
    if (profile?.teamId) return profile.teamId;
  } catch {
    // fall through to the coach configuration fallback
  }

  try {
    const config = await configurationCoachService.getCurrent();
    return config?.preferredTeamId ?? null;
  } catch {
    return null;
  }
}
