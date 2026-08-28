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
  teamPlayerId: string;
  playerName: string;
  photoUrl?: string | null;
  totalTrainings: number;
  attendedTrainings: number;
  absentTrainings: number;
  pendingTrainings: number;
  absences: PlayerAbsenceDetail[];
};

export type MatchAttendanceCellState = "starter" | "called" | "notCalled" | "absent";

export type MatchAttendanceCell = {
  eventId: string;
  state: MatchAttendanceCellState;
  wasCalled: boolean;
  wasStarter: boolean;
};

export type MatchAttendanceColumn = {
  eventId: string;
  label: string;
  date: string | null;
  rival: string | null;
};

export type PlayerMatchSummary = {
  playerId: string;
  playerName: string;
  totalMatches: number;
  calledMatches: number;
  startedMatches: number;
  notCalledMatches: number;
  cells: MatchAttendanceCell[];
};
