import type { GameModel } from "../types/gameModel";

export const mockGameModel: GameModel = {
  id: "mock-model-2025-2026",
  teamId: "mock-team-1",
  name: "Modelo de Juego 2025/2026",
  season: "2025/2026",
  gameMoments: [
    {
      id: 1,
      name: "Defensa Organizada",
      zones: [
        {
          id: 1,
          name: "Zona de Iniciación",
          principles: [
            {
              id: 1,
              gameMomentId: 1,
              gameZoneId: 1,
              order: 1,
              title: "El rival juega por bandas",
              description:
                "Agrupa los escenarios en los que el rival progresa por los carriles laterales.",
              scenarios: [
                {
                  id: 1,
                  order: 1,
                  name: "El rival juega por bandas",
                  context:
                    "El equipo rival ha progresado y está atacando nuestro primer tercio de campo. Todo el equipo está en nuestro campo.",
                  subPrinciples: [
                    {
                      id: 1,
                      order: 1,
                      label: "A",
                      name: "Evitar que el rival profundice por banda",
                      context:
                        "El rival progresa por los carriles laterales buscando el desborde para centrar o recortar hacia dentro. Nuestro equipo está en bloque bajo.",
                      subSubPrinciples: [
                        {
                          id: 1,
                          order: 1,
                          name: "El lateral de banda activa acosa y orienta",
                          action:
                            "Es el defensor primario. Debe encimar al extremo rival para frenar su avance, orientándolo siempre hacia la línea de banda o hacia la ayuda de su compañero.",
                          essentialSkills: [
                            {
                              id: 1,
                              name: "Perfilamiento defensivo",
                              description:
                                "Colocar el cuerpo para «invitar» al rival hacia fuera, cerrando el carril interior.",
                            },
                            {
                              id: 2,
                              name: "Temporización",
                              description:
                                "Saber aguantar sin entrar al balón hasta que llegue la ayuda del extremo.",
                            },
                          ],
                        },
                        {
                          id: 2,
                          order: 2,
                          name: "El extremo de banda activa realiza la cobertura o doble marcaje",
                          action:
                            "Se sitúa por detrás del lateral (cobertura) o salta junto a él para realizar un 2x1 si el rival se detiene.",
                          essentialSkills: [
                            {
                              id: 3,
                              name: "Solidaridad defensiva",
                              description:
                                "Capacidad de sacrificio para correr hacia atrás y proteger la espalda de su lateral.",
                            },
                            {
                              id: 4,
                              name: "Interceptación de doblajes",
                              description:
                                "Estar atento al lateral rival que sube por fuera o por dentro.",
                            },
                          ],
                        },
                      ],
                    },
                    {
                      id: 2,
                      order: 2,
                      label: "B",
                      name: "Cerrar el carril central ante centros",
                      context:
                        "Cuando el rival llega a la línea de fondo o a la zona de córner y prepara un centro al área.",
                      subSubPrinciples: [
                        {
                          id: 3,
                          order: 1,
                          name: "El central de lado más cercano cierra el punto de penalti",
                          action:
                            "Anticipa el movimiento del delantero rival en el punto de penalti, ganando la posición antes de que se produzca el centro.",
                          essentialSkills: [
                            {
                              id: 5,
                              name: "Lectura del vuelo del balón",
                              description:
                                "Anticipar la trayectoria del centro para llegar primero al balón.",
                            },
                            {
                              id: 6,
                              name: "Juego aéreo ofensivo",
                              description:
                                "Ganar el duelo de cabeza y alejar el balón del área con claridad.",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 2,
              gameMomentId: 1,
              gameZoneId: 1,
              order: 2,
              title: "El rival juega por el centro con pase entre líneas",
              description:
                "El rival intenta introducir el balón entre nuestra línea de mediocampo y la defensa con pases interiores al mediapunta o al segundo delantero.",
              scenarios: [
                {
                  id: 2,
                  order: 1,
                  name: "El rival juega por el centro con pase entre líneas",
                  context:
                    "El rival intenta introducir el balón entre nuestra línea de mediocampo y la defensa con pases interiores al mediapunta o al segundo delantero.",
                  subPrinciples: [
                    {
                      id: 3,
                      order: 1,
                      label: "A",
                      name: "Cerrar la línea de pase interior",
                      context:
                        "El mediocentro defensor debe orientar su posición para tapar el pase entre líneas antes de que el rival lo intente.",
                      subSubPrinciples: [
                        {
                          id: 4,
                          order: 1,
                          name: "El pivote se orienta para tapar la línea de pase",
                          action:
                            "Mantiene la mirada sobre el balón y el receptor potencial, desplazándose lateralmente para cortar la trayectoria del pase interior.",
                          essentialSkills: [
                            {
                              id: 7,
                              name: "Visión táctica",
                              description:
                                "Identificar qué línea de pase es más peligrosa y priorizarla.",
                            },
                            {
                              id: 8,
                              name: "Posición corporal defensiva",
                              description:
                                "Mantenerse de lado para controlar al receptor a la vez que se cierra el pase.",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 2,
          name: "Zona de Creación en Campo Propio",
          principles: [
            {
              id: 3,
              gameMomentId: 1,
              gameZoneId: 2,
              order: 1,
              title: "El rival presiona nuestra salida de balón",
              description:
                "El rival aplica presión alta tras perder el balón, buscando recuperarlo en nuestra zona defensiva para atacar en transición.",
              scenarios: [
                {
                  id: 3,
                  order: 1,
                  name: "El rival presiona nuestra salida de balón",
                  context:
                    "El rival aplica presión alta tras perder el balón, buscando recuperarlo en nuestra zona defensiva para atacar en transición.",
                  subPrinciples: [
                    {
                      id: 4,
                      order: 1,
                      label: "A",
                      name: "Generar superioridad numérica construyendo desde atrás",
                      context:
                        "Nuestros centrales y portero forman un triángulo para superar la primera línea de presión rival.",
                      subSubPrinciples: [
                        {
                          id: 5,
                          order: 1,
                          name: "El portero actúa como tercer central",
                          action:
                            "Sale de la portería para ofrecer una línea de pase disponible y romper la presión del primer delantero rival.",
                          essentialSkills: [
                            {
                              id: 9,
                              name: "Pase con el pie",
                              description:
                                "Dominio técnico del pase corto y largo con ambos pies en situaciones de presión.",
                            },
                            {
                              id: 10,
                              name: "Comunicación",
                              description:
                                "Indicar constantemente a los centrales su posición y la presencia de rivales.",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { id: 3, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 4, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 2,
      name: "Ataque Organizado",
      zones: [
        {
          id: 5,
          name: "Zona de Iniciación",
          principles: [
            {
              id: 4,
              gameMomentId: 2,
              gameZoneId: 5,
              order: 1,
              title: "El rival se repliega en bloque bajo",
              description:
                "El rival defiende con todos sus jugadores en su propio campo formando un bloque compacto. Disponemos de tiempo y espacio para organizar el juego desde atrás.",
              scenarios: [
                {
                  id: 4,
                  order: 1,
                  name: "El rival se repliega en bloque bajo",
                  context:
                    "El rival defiende con todos sus jugadores en su propio campo formando un bloque compacto. Disponemos de tiempo y espacio para organizar el juego desde atrás.",
                  subPrinciples: [
                    {
                      id: 5,
                      order: 1,
                      label: "A",
                      name: "Uso del lateral para dar amplitud y atraer presión",
                      context:
                        "Los laterales se proyectan muy abiertos para estirar la defensa rival y crear espacios interiores para los centrocampistas.",
                      subSubPrinciples: [
                        {
                          id: 6,
                          order: 1,
                          name: "El lateral sube hasta la línea del mediocampo rival",
                          action:
                            "Se proyecta altísimo por la banda, obligando al lateral rival a seguirle y dejando espacio interior para el extremo.",
                          essentialSkills: [
                            {
                              id: 11,
                              name: "Capacidad física de subida y bajada",
                              description:
                                "Resistencia para realizar el ciclo completo de proyección ofensiva y recuperación defensiva.",
                            },
                            {
                              id: 12,
                              name: "Centros al área",
                              description:
                                "Ejecutar centros precisos tras recibir en una posición adelantada.",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { id: 6, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 7, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 8, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 3,
      name: "Transición Defensa-Ataque",
      zones: [
        { id: 9, name: "Zona de Iniciación", principles: [] },
        { id: 10, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 11, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 12, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 4,
      name: "Transición Ataque-Defensa",
      zones: [
        { id: 13, name: "Zona de Iniciación", principles: [] },
        { id: 14, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 15, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 16, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 5,
      name: "Balón Parado",
      zones: [
        { id: 17, name: "Zona de Iniciación", principles: [] },
        { id: 18, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 19, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 20, name: "Zona de Finalización", principles: [] },
      ],
    },
  ],
};

export const mockGameModel_2024_2025: GameModel = {
  id: "mock-model-2024-2025",
  teamId: "mock-team-1",
  name: "Modelo de Juego 2024/2025",
  season: "2024/2025",
  gameMoments: [
    {
      id: 1,
      name: "Defensa Organizada",
      zones: [
        {
          id: 1,
          name: "Zona de Iniciación",
          principles: [
            {
              id: 1,
              gameMomentId: 1,
              gameZoneId: 1,
              order: 1,
              title: "Bloque bajo ante equipos con posesión",
              description:
                "El rival mantiene la posesión con paciencia en nuestro campo. Defendemos en bloque bajo esperando el error o el pase entre líneas para recuperar.",
              scenarios: [
                {
                  id: 1,
                  order: 1,
                  name: "Bloque bajo ante equipos con posesión",
                  context:
                    "El rival mantiene la posesión con paciencia en nuestro campo. Defendemos en bloque bajo esperando el error o el pase entre líneas para recuperar.",
                  subPrinciples: [
                    {
                      id: 1,
                      order: 1,
                      label: "A",
                      name: "Mantener el bloque entre líneas compacto",
                      context:
                        "Las líneas defensiva y media deben mantenerse juntas, sin dejar espacio entre ellas para evitar el pase al pie del mediapunta rival.",
                      subSubPrinciples: [
                        {
                          id: 1,
                          order: 1,
                          name: "El mediocentro cierra el espacio entre líneas",
                          action:
                            "Se sitúa entre la línea defensiva y la de ataque, moviéndose lateralmente con el balón para cortar posibles pases interiores.",
                          essentialSkills: [
                            {
                              id: 1,
                              name: "Movilidad lateral",
                              description:
                                "Capacidad de desplazarse rápidamente de lado para cubrir espacios sin romper la estructura.",
                            },
                            {
                              id: 2,
                              name: "Lectura de líneas de pase",
                              description:
                                "Anticipar el destino del pase para interceptar o bloquear la trayectoria.",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { id: 2, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 3, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 4, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 2,
      name: "Ataque Organizado",
      zones: [
        { id: 5, name: "Zona de Iniciación", principles: [] },
        { id: 6, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 7, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 8, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 3,
      name: "Transición Defensa-Ataque",
      zones: [
        { id: 9, name: "Zona de Iniciación", principles: [] },
        { id: 10, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 11, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 12, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 4,
      name: "Transición Ataque-Defensa",
      zones: [
        { id: 13, name: "Zona de Iniciación", principles: [] },
        { id: 14, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 15, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 16, name: "Zona de Finalización", principles: [] },
      ],
    },
    {
      id: 5,
      name: "Balón Parado",
      zones: [
        { id: 17, name: "Zona de Iniciación", principles: [] },
        { id: 18, name: "Zona de Creación en Campo Propio", principles: [] },
        { id: 19, name: "Zona de Creación en Campo Rival", principles: [] },
        { id: 20, name: "Zona de Finalización", principles: [] },
      ],
    },
  ],
};

/** Map teamId → available seasons (descending order) */
export const mockSeasonsByTeam: Record<string, string[]> = {
  "1": ["2025/2026", "2024/2025"],
};

/** Map season → GameModel */
export const mockModelsBySeason: Record<string, GameModel> = {
  "2025/2026": mockGameModel,
  "2024/2025": mockGameModel_2024_2025,
};

/** Fixed moments + zones structure used to initialise an empty draft */
export function createEmptyDraft(teamId: string, season: string): GameModel {
  const zones = (startId: number) => [
    { id: startId, name: "Zona de Iniciación", principles: [] },
    { id: startId + 1, name: "Zona de Creación en Campo Propio", principles: [] },
    { id: startId + 2, name: "Zona de Creación en Campo Rival", principles: [] },
    { id: startId + 3, name: "Zona de Finalización", principles: [] },
  ];
  return {
    id: "",
    teamId,
    season,
    name: `Modelo de Juego ${season}`,
    gameMoments: [
      { id: 1, name: "Defensa Organizada", zones: zones(1) },
      { id: 2, name: "Ataque Organizado", zones: zones(5) },
      { id: 3, name: "Transición Defensa-Ataque", zones: zones(9) },
      { id: 4, name: "Transición Ataque-Defensa", zones: zones(13) },
      { id: 5, name: "Balón Parado", zones: zones(17) },
    ],
  };
}
