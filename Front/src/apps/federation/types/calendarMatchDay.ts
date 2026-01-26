export type CalendarRoundInfo = {
  matchDayNumber: number;
  date: string;
  name: string;
};

export type CalendarMatch = {
  matchRecordCode: string;
  hasRecords: string;
  recordClosed: string;
  gameSituation: string;
  observations: string;

  date: string;
  time: string;

  field: string;
  fieldCode: string;

  status: string;
  statusReason: string;

  matchInProgress: string;
  provisionalResult: string;

  referee: string;
  penalties: string;
  extraTimeWin: string;
  extraTimeWinnerTeam: string;

  localTeamCode: string;
  localTeamName: string;
  localTeamImageUrl: string;
  localTeamWithdrawn: string;
  localGoals: string;
  localPenalties: string;

  visitorTeamCode: string;
  visitorTeamName: string;
  visitorTeamImageUrl: string;
  visitorTeamWithdrawn: string;
  visitorGoals: string;
  visitorPenalties: string;

  originRecordCode: string;

  localTeamPosition?: number;
  visitorTeamPosition?: number;
};

export type CalendarMatchDay = {
  date: string;
  matchDayNumber: number;
  matches: CalendarMatch[];
};

export type CalendarMatchDayWithRoundsResponse = {
  round: number;
  competitionName: string;
  groupName: string;
  groupId: number;
  rounds: CalendarRoundInfo[];
  matchDay: CalendarMatchDay;
};
