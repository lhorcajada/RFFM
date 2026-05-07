export type Summary = {
  events: number;
  attend: number;
  absent: number;
  pending: number;
};

export type SummaryByType = {
  total: Summary;
  training: Summary;
  match: Summary;
  other: Summary;
};

export type PlayerAbsenceDetail = {
  eventId: string;
  eventTitle: string;
  date: string | null;
  reason: string;
};

export type PlayerTrainingSummary = {
  playerId: string;
  playerName: string;
  totalTrainings: number;
  attendedTrainings: number;
  absentTrainings: number;
  pendingTrainings: number;
  absences: PlayerAbsenceDetail[];
};
