export interface MatchEntry {
  codacta?: string;
  codigo_equipo_local?: string;
  escudo_equipo_local?: string;
  escudo_equipo_local_url?: string;
  equipo_local?: string;
  goles_casa?: string | number;

  codigo_equipo_visitante?: string;
  escudo_equipo_visitante?: string;
  escudo_equipo_visitante_url?: string;
  equipo_visitante?: string;
  goles_visitante?: string | number;

  codigo_campo?: string;
  campo?: string;
  fecha?: string;
  hora?: string;

  // keep optional catch-all for unexpected properties
  [key: string]: any;
}

export interface Round {
  codjornada?: string;
  jornada?: string;
  equipos?: MatchEntry[];
  [key: string]: any;
}

export interface CalendarResponse {
  estado?: string;
  sesion_ok?: string;
  competicion?: string;
  tipo_competicion?: string;
  grupo?: string;
  temporada?: string;
  rounds?: Round[];
  [key: string]: any;
}

// New API models: matchDays payload (as provided)
export interface MatchApiMatch {
  matchRecordCode?: string;
  hasRecords?: string;
  recordClosed?: string;
  gameSituation?: string;
  observations?: string;
  date?: string; // ISO string
  time?: string;
  field?: string;
  fieldCode?: string;
  status?: string;
  statusReason?: string;
  matchInProgress?: string;
  provisionalResult?: string;
  referee?: string;
  penalties?: string;
  extraTimeWin?: string;
  extraTimeWinnerTeam?: string;
  localTeamCode?: string;
  localTeamName?: string;
  localTeamImageUrl?: string;
  localTeamWithdrawn?: string;
  localGoals?: string;
  localPenalties?: string;
  visitorTeamCode?: string;
  visitorTeamName?: string;
  visitorTeamImageUrl?: string;
  visitorTeamWithdrawn?: string;
  visitorGoals?: string;
  visitorPenalties?: string;
  originRecordCode?: string;
  [key: string]: any;
}

export interface MatchDay {
  date?: string; // ISO date
  matchDayNumber?: number;
  matches?: MatchApiMatch[];
  [key: string]: any;
}

export interface MatchApiResponse {
  matchDays?: MatchDay[];
  [key: string]: any;
}
