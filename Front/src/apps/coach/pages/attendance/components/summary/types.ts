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

export type EventAttendancePoint = {
  eventId: string;
  /** Short axis label, e.g. "J3", "A1", "E12", "R1". */
  label: string;
  date: string | null;
  /** Full name shown in tooltip/table, e.g. "J3 · vs Parla", "Entrenamiento 12". */
  title: string;
  /** Convocations counted for this event (attend + absent). */
  total: number;
  attend: number;
  absent: number;
};

export type CategoryAttendance = {
  /** Unchanged aggregate, still used for the card's headline %. */
  summary: Summary;
  /** Chronological order, oldest first — windowing takes the last N. */
  events: EventAttendancePoint[];
};

export type DashboardData = {
  total: Summary;
  training: CategoryAttendance;
  match: CategoryAttendance;
  other: CategoryAttendance;
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
