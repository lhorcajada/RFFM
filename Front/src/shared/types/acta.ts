export interface GoalEvent {
  codjugador?: string;
  nombre_jugador?: string;
  minuto?: string;
  tipo_gol?: string;
  [key: string]: any;
}

export interface PlayerActa {
  codjugador?: string;
  foto?: string;
  dorsal?: string;
  sexo?: string;
  nombre_jugador?: string;
  titular?: string;
  suplente?: string;
  capitan?: string;
  portero?: string;
  posicion?: string;
  posicion_jugador_abreviatura?: string;
  ver_estadisiticas_jugador?: string;
  [key: string]: any;
}

export interface Substitution {
  minuto?: string;
  entradorsal?: string;
  codjugador_entra?: string;
  nombre_jugador_entra?: string;
  saledorsal?: string;
  codjugador_sale?: string;
  nombre_jugador_sale?: string;
  // also accept server-side PascalCase or English fields
  Minute?: string;
  EnteringNumber?: string;
  EnteringPlayerCode?: string;
  EnteringPlayerName?: string;
  ExitingNumber?: string;
  ExitingPlayerCode?: string;
  ExitingPlayerName?: string;
  [key: string]: any;
}

export interface Technician {
  foto?: string;
  tipo?: string;
  cod_tecnico?: string;
  nombre?: string;
  [key: string]: any;
}

export interface CardEvent {
  codigo_tipo_amonestacion?: string;
  codjugador?: string;
  segunda_amarilla?: string;
  minuto?: string;
  nombre_jugador?: string;
  [key: string]: any;
}

export interface Referee {
  cod_arbitro?: string;
  tipo_arbitro?: string;
  nombre_arbitro?: string;
  [key: string]: any;
}

export interface Acta {
  estado?: string;
  sesion_ok?: string;
  codacta?: string;
  nombre_competicion?: string;
  nombre_grupo?: string;
  jornada?: string;
  fecha?: string;
  hora?: string;
  campo?: string;
  codigo_campo?: string;
  acta_cerrada?: string;
  partido_en_juego?: string;
  codigo_equipo_local?: string;
  esquema_local?: string;
  equipo_local?: string;
  escudo_local?: string;
  goles_local?: string;
  codigo_equipo_visitante?: string;
  esquema_visitante?: string;
  equipo_visitante?: string;
  escudo_visitante?: string;
  goles_visitante?: string;
  hay_penaltis?: string;
  penaltis_casa?: string;
  penaltis_fuera?: string;
  suspendido?: string;
  codacta_origen?: string;
  goles_penalti?: any[];
  goles_equipo_local?: GoalEvent[];
  goles_equipo_visitante?: GoalEvent[];
  foto_delegadocampo?: string;
  delegadocampo?: string;
  foto_delegadolocal?: string;
  delegadolocal?: string;
  foto_entrenador_local?: string;
  cod_entrenador_local?: string;
  entrenador_local?: string;
  foto_entrenador2_local?: string;
  cod_entrenador2_local?: string;
  entrenador2_local?: string;
  otros_tecnicos_local?: Technician[];
  jugadores_equipo_local?: PlayerActa[];
  foto_delegado_visitante?: string;
  delegado_visitante?: string;
  foto_entrenador_visitante?: string;
  cod_entrenador_visitante?: string;
  entrenador_visitante?: string;
  foto_entrenador_visitante2?: string;
  cod_entrenador_visitante2?: string;
  entrenador2_visitante?: string;
  otros_tecnicos_visitante?: Technician[];
  jugadores_equipo_visitante?: PlayerActa[];
  sustituciones_equipo_local?: Substitution[];
  sustituciones_equipo_visitante?: Substitution[];
  tarjetas_equipo_local?: CardEvent[];
  tarjetas_equipo_visitante?: CardEvent[];
  otras_tarjetas?: CardEvent[];
  arbitros_partido?: Referee[];
  [key: string]: any;
}

export default Acta;
