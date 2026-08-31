export type MatchCategory = "League" | "Friendly" | "Tournament" | null;

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
  eventId?: string;
  /** Backend-computed category — "League" | "Friendly" | "Tournament" | null (non-match event) */
  matchCategory?: MatchCategory;
};

export type MatchResult = "won" | "draw" | "lost" | "played" | null;
