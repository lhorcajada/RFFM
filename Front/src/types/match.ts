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
