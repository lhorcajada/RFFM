import client from "../../../core/api/client";

export type ObservationAssessment = "Achieved" | "Partial" | "NotAchieved";

export const ASSESSMENT_LABELS: Record<ObservationAssessment, string> = {
  Achieved: "Lo hace",
  Partial: "A veces",
  NotAchieved: "No lo hace",
};

export type PlayerObservation = {
  id: string;
  date: string;
  kind: string;
  subprincipioId: string | null;
  momentName: string | null;
  principleLabel: string | null;
  subprincipioLabel: string | null;
  assessment: ObservationAssessment;
  comment: string | null;
  createdAt: string;
  trainingSessionId: string | null;
  trainingSessionName: string | null;
};

export type CreatePlayerObservationRequest = {
  date: string;
  subprincipioId: string;
  assessment: ObservationAssessment;
  comment?: string | null;
  trainingSessionId?: string | null;
};

function observationsUrl(teamId: string, teamPlayerId: string): string {
  return `/api/teams/${encodeURIComponent(teamId)}/players/${encodeURIComponent(teamPlayerId)}/observations`;
}

export async function getPlayerObservations(teamId: string, teamPlayerId: string): Promise<PlayerObservation[]> {
  const resp = await client.get<PlayerObservation[]>(observationsUrl(teamId, teamPlayerId));
  return resp.data;
}

export async function createPlayerObservation(
  teamId: string,
  teamPlayerId: string,
  request: CreatePlayerObservationRequest,
): Promise<PlayerObservation> {
  const resp = await client.post<PlayerObservation>(observationsUrl(teamId, teamPlayerId), request);
  return resp.data;
}
