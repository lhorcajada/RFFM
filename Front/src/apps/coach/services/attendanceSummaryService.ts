import client from "../../../core/api/client";

export type TrainingAbsenceDetail = {
  eventId: string;
  eventTitle: string;
  date: string | null;
  assistanceTypeId?: number | null;
  excuseTypeId?: number | null;
  reason: string;
};

export type TrainingAttendancePlayerSummary = {
  teamPlayerId: string;
  playerId?: string | null;
  playerName: string;
  totalTrainings: number;
  attendedTrainings: number;
  absentTrainings: number;
  pendingTrainings: number;
  absences: TrainingAbsenceDetail[];
};

export type TrainingAttendanceSummaryResponse = {
  totalTrainingEvents: number;
  players: TrainingAttendancePlayerSummary[];
};

export async function getTrainingAttendanceSummary(
  teamId: string,
  seasonId?: string | null
): Promise<TrainingAttendanceSummaryResponse> {
  const params: Record<string, string> = {};
  if (seasonId) params.seasonId = seasonId;

  const resp = await client.get<TrainingAttendanceSummaryResponse>(
    `/api/attendance/training-summary/${teamId}`,
    { params }
  );

  return resp.data;
}

export type TeamConvocationRow = {
  eventId: string;
  convocationId: string;
  teamPlayerId: string;
  playerId?: string | null;
  alias: string;
  statusId?: number | null;
  excuseTypeId?: number | null;
  assistanceTypeId?: number | null;
};

export async function getTeamConvocationsSummary(teamId: string): Promise<TeamConvocationRow[]> {
  const resp = await client.get<TeamConvocationRow[]>(`/api/attendance/team-convocations/${teamId}`);
  return resp.data;
}

export default { getTrainingAttendanceSummary, getTeamConvocationsSummary };
