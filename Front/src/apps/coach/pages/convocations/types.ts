export type NormalizedMatch = {
  date: string; // "YYYY-MM-DD"
  time: string;
  localTeamName: string;
  localTeamShield: string;
  localGoals: string | null;
  visitorTeamName: string;
  visitorTeamShield: string;
  visitorGoals: string | null;
  isFinished: boolean;
  /** true if the user's team is the local/home team in this match */
  isHomeTeam: boolean;
  field: string;
  codacta: string | null;
  selectedKitNumber: number | null;
};

export type MatchResult = "won" | "draw" | "lost" | "played" | null;
