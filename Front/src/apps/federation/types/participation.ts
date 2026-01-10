export type TeamParticipationSummaryPlayer = {
  playerId?: number | string;
  id?: number | string;
  name?: string;
};

export type TeamParticipationSummaryItem = {
  competitionName: string;
  groupName: string;
  teamName: string;
  teamCode?: string;
  teamPoints?: number;
  count?: number;
  players?: TeamParticipationSummaryPlayer[];
};
