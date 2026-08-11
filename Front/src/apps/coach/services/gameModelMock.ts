import type { GameModel, GameMomentCatalogItem } from "../types/gameModel";

/** Fixed Fase catalog — matches GameModelKeys.FaseSlugsById on the backend. */
export const mockGameMoments: GameMomentCatalogItem[] = [
  { id: 1, name: "Defensa Organizada", order: 1 },
  { id: 2, name: "Ataque Organizado", order: 2 },
  { id: 3, name: "Transición Defensa-Ataque", order: 3 },
  { id: 4, name: "Transición Ataque-Defensa", order: 4 },
  { id: 5, name: "Balón Parado", order: 5 },
];

/**
 * Fixture rebuilt from the technical import spec §6 (the importer's own golden test case),
 * extended with a Subprincipio that hangs its SubSubPrincipios directly (no Zona) so both
 * shapes are exercised, plus a flat SetPieceRule and an OpenIssue.
 */
export const mockGameModel: GameModel = {
  id: "mock-model-2025-2026",
  teamId: "mock-team-1",
  name: "Modelo de Juego 2025/2026",
  season: "2025/2026",
  principles: [
    {
      id: 1,
      apiId: "principio-defensa-organizada-1",
      key: "defensa-organizada-1",
      gameMomentId: 1,
      gameMomentName: "Defensa Organizada",
      numero: 1,
      titulo: "No permitir progresar al rival",
      texto:
        "Objetivo transversal de toda la fase: impedir que el rival avance hacia nuestra portería, sin especificar todavía la vía concreta (puede ser por dentro, por fuera o en profundidad — eso lo definen los subprincipios).",
      notas: [],
      subprincipios: [
        {
          id: 1,
          apiId: "subprincipio-1.1",
          key: "defensa-organizada-1.1",
          numero: "1.1",
          titulo: "Evitar que el rival supere nuestra primera línea de presión",
          texto:
            "Una de las formas de no dejar progresar al rival es no permitirle superar con comodidad la línea más adelantada de presión, obligándole a jugar hacia atrás, hacia los lados, o a perder el balón directamente ahí.",
          notas: [],
          subSubPrincipios: [],
          zonas: [
            {
              id: 1,
              apiId: "zona-1.1-finalizacion",
              key: "defensa-organizada-1.1-finalizacion",
              zoneKeys: ["finalizacion"],
              label: null,
              zonaTexto: null,
              texto:
                "La zona más cercana a la portería rival — aquí el equipo presiona altísimo, buscando robar lo más lejos posible de nuestra portería. Se aceptan riesgos calculados. Sistema base asumido: 1-4-2-3-1.",
              notas: [
                {
                  id: 1,
                  apiId: "nota-1",
                  tipo: "riesgo-aceptado",
                  texto:
                    "El lateral opuesto rival queda completamente libre. Se acepta porque está lejos del balón y del peligro inmediato — la recompensa de robar cerca de su área compensa el riesgo.",
                },
              ],
              subSubPrincipios: [
                {
                  id: 1,
                  apiId: "ssp-1.1.1",
                  key: "defensa-organizada-1.1.1",
                  numero: "1.1.1",
                  rol: "Delantero",
                  texto:
                    "Arranca desde el carril central pegado al área, presiona al central con balón, corriendo en curva entre el central y el portero, para obligarle a centrar hacia la banda.",
                  notas: [],
                  habilidades: [
                    {
                      id: 1,
                      apiId: "hab-1",
                      nombre: "Activación",
                      descripcion:
                        "Arranca la presión en cuanto detecta el movimiento del balón hacia el central, no cuando ya lo ha recibido o controlado.",
                      entrenable:
                        "Presión iniciada a la señal del pase hacia el central, penalizando la salida tardía tras la recepción.",
                      referenciaAKey: null,
                    },
                    {
                      id: 2,
                      apiId: "hab-2",
                      nombre: "Perfilamiento",
                      descripcion:
                        "Orienta el cuerpo en la carrera describiendo una curva, para cerrar la vía de pase más segura (hacia atrás) y forzar el pase lateral.",
                      entrenable:
                        "Ejercicios de presión al central con portero, evaluando si el ángulo de aproximación cierra la vía de vuelta.",
                      referenciaAKey: null,
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
      apiId: "principio-defensa-organizada-2",
      key: "defensa-organizada-2",
      gameMomentId: 1,
      gameMomentName: "Defensa Organizada",
      numero: 2,
      titulo: "Recuperar el balón",
      texto:
        "Este principio es sobre cuándo pasamos de contener a robar activamente. Los subprincipios de este bloque son, sobre todo, gatillos.",
      notas: [],
      subprincipios: [
        {
          id: 2,
          apiId: "subprincipio-2.1",
          key: "defensa-organizada-2.1",
          numero: "2.1",
          titulo: "Robar el balón cuando el rival no controla bien",
          texto:
            "Cuando el control del rival aleja el balón de su cuerpo más de lo normal, es el gatillo más claro para intentar el robo.",
          notas: [],
          zonas: [],
          subSubPrincipios: [
            {
              id: 2,
              apiId: "ssp-2.1.1",
              key: "defensa-organizada-2.1.1",
              numero: "2.1.1",
              rol: "Jugador más cercano al balón",
              texto:
                "Ataca el balón de inmediato en el instante en que detecta que el control del rival lo ha alejado de su cuerpo.",
              notas: [],
              habilidades: [
                {
                  id: 3,
                  apiId: "hab-3",
                  nombre: "Anticipación",
                  descripcion:
                    "Reconoce el instante exacto en que el balón queda lejos del cuerpo del rival tras un control deficiente, y ataca sin dudar.",
                  entrenable:
                    "Ejercicios con controles inducidos a fallar, exigiendo que el jugador más cercano ataque en el primer instante de descontrol.",
                  referenciaAKey: null,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  setPieceRules: [
    {
      id: 1,
      apiId: "spr-1",
      subtype: "corners-defensivos",
      texto:
        "Defendemos con marcaje mixto: dos jugadores en zona en los postes, el resto al hombre sobre los rivales más peligrosos.",
    },
  ],
  openIssues: [
    {
      id: 1,
      apiId: "issue-1",
      topic: "Revisión de coherencia de los escenarios ya construidos",
      description:
        "Defensa organizada / zona de iniciación, contra este ADN, especialmente en el uso del fuera de juego por zona. Se hará más adelante.",
      status: "open",
    },
  ],
};

/** Map teamId → available seasons (descending order). */
export const mockSeasonsByTeam: Record<string, string[]> = {
  "1": ["2025/2026"],
};

/** Map season → GameModel. */
export const mockModelsBySeason: Record<string, GameModel> = {
  "2025/2026": mockGameModel,
};

/** Empty draft used to initialise a new game model. */
export function createEmptyDraft(teamId: string, season: string): GameModel {
  return {
    id: "",
    teamId,
    season,
    name: `Modelo de Juego ${season}`,
    principles: [],
    setPieceRules: [],
    openIssues: [],
  };
}
