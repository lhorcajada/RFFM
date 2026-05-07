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

export default { getTrainingAttendanceSummary };
