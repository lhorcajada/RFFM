export type Summary = {
  events: number;
  attend: number;
  absent: number;
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
  dorsal?: number | null;
  position?: string | null;
  totalTrainings: number;
  attendedTrainings: number;
  absentTrainings: number;
  absences: PlayerAbsenceDetail[];
};

// "technicalDecision" | "unavailable" | "injury" | "illness" are the four sub-states of
// "not called up", classified from the convocation's excuseTypeId (see matchAttendanceState.ts).
// "absent" means there is no convocation record at all for that player/event.
export type MatchAttendanceCellState =
  | "starter"
  | "called"
  | "technicalDecision"
  | "unavailable"
  | "injury"
  | "illness"
  | "absent";

export type MatchAttendanceCell = {
  eventId: string;
  state: MatchAttendanceCellState;
  wasCalled: boolean;
  wasStarter: boolean;
  minutesPlayed: number | null;
};

export type MatchAttendanceColumn = {
  eventId: string;
  label: string;
  date: string | null;
  rival: string | null;
  isFriendly: boolean;
};

export type PlayerMatchSummary = {
  playerId: string;
  playerName: string;
  photoUrl?: string | null;
  dorsal?: number | null;
  position?: string | null;
  totalMatches: number;
  calledMatches: number;
  startedMatches: number;
  /** Total not-called matches, i.e. technicalDecisionMatches + unavailableMatches + injuryMatches + illnessMatches. */
  notCalledMatches: number;
  technicalDecisionMatches: number;
  unavailableMatches: number;
  injuryMatches: number;
  illnessMatches: number;
  seasonMinutesPlayed: number;
  cells: MatchAttendanceCell[];
};
