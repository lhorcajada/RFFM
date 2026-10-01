import client from "../../../core/api/client";

export type ObservationAssessment = "Achieved" | "Partial" | "NotAchieved";

export type ObservationKind = "GameModel" | "Attitude";

/** Catálogo cerrado de rasgos de actitud; mismo orden y claves que `AttitudeTraits.cs` en el backend. */
export const ATTITUDE_TRAITS: { key: string; label: string }[] = [
  { key: "defensive-commitment", label: "Implicación en tareas defensivas" },
  { key: "patience", label: "Paciencia con balón" },
  { key: "courage-in-duels", label: "Valentía en los duelos" },
  { key: "off-ball-effort", label: "Esfuerzo sin balón" },
  { key: "listening", label: "Escucha y aplicación de consignas" },
  { key: "focus", label: "Concentración durante la tarea" },
];

export const ASSESSMENT_LABELS: Record<ObservationAssessment, string> = {
  Achieved: "Lo hace",
  Partial: "A veces",
  NotAchieved: "No lo hace",
};

export type PlayerObservation = {
  id: string;
  date: string;
  kind: ObservationKind;
  subprincipioId: string | null;
  momentName: string | null;
  principleLabel: string | null;
  subprincipioLabel: string | null;
  assessment: ObservationAssessment;
  comment: string | null;
  createdAt: string;
  trainingSessionId: string | null;
  trainingSessionName: string | null;
  attitudeKey: string | null;
  attitudeLabel: string | null;
};

export type CreatePlayerObservationRequest = {
  kind?: ObservationKind;
  date: string;
  subprincipioId?: string;
  attitudeKey?: string;
  assessment: ObservationAssessment;
  comment?: string | null;
  trainingSessionId?: string | null;
};

export type UpdatePlayerObservationRequest = {
  assessment: ObservationAssessment;
  comment?: string | null;
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

export async function updatePlayerObservation(
  teamId: string,
  teamPlayerId: string,
  observationId: string,
  request: UpdatePlayerObservationRequest,
): Promise<PlayerObservation> {
  const resp = await client.put<PlayerObservation>(
    `${observationsUrl(teamId, teamPlayerId)}/${encodeURIComponent(observationId)}`,
    request,
  );
  return resp.data;
}

export async function deletePlayerObservation(teamId: string, teamPlayerId: string, observationId: string): Promise<void> {
  await client.delete(`${observationsUrl(teamId, teamPlayerId)}/${encodeURIComponent(observationId)}`);
}
