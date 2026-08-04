import { createContext, useContext, useReducer, type ReactNode } from "react";
import type {
  GameModel,
  Principle,
  Scenario,
  SubPrinciple,
  SubSubPrinciple,
  EssentialSkill,
} from "../types/gameModel";

// ─── Temp-ID counter (negatives = unsaved) ───────────────────────────
let _idCounter = -1;
const nextId = () => _idCounter--;

// ─── Actions ─────────────────────────────────────────────────────────
type Action =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_SEASON"; value: string }
  | { type: "SET_DRAFT"; draft: GameModel }
  // Principle
  | { type: "ADD_PRINCIPLE"; mi: number; zi: number }
  | {
      type: "UPD_PRINCIPLE";
      mi: number;
      zi: number;
      pi: number;
      changes: Partial<Pick<Principle, "title" | "description">>;
    }
  | { type: "DEL_PRINCIPLE"; mi: number; zi: number; pi: number }
  // Scenario
  | { type: "ADD_SCENARIO"; mi: number; zi: number; pi: number }
  | {
      type: "UPD_SCENARIO";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      changes: Partial<Pick<Scenario, "name" | "context" | "mediaUrl" | "mediaType">>;
    }
  | { type: "DEL_SCENARIO"; mi: number; zi: number; pi: number; si: number }
  | {
      type: "MOVE_SCENARIO_LOCATION";
      fromMi: number;
      fromZi: number;
      fromPi: number;
      si: number;
      toMi: number;
      toZi: number;
      toPi: number;
      order?: number;
    }
  // SubPrinciple
  | { type: "ADD_SP"; mi: number; zi: number; pi: number; si: number }
  | {
      type: "UPD_SP";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      changes: Partial<Pick<SubPrinciple, "name" | "context">>;
    }
  | { type: "DEL_SP"; mi: number; zi: number; pi: number; si: number; spi: number }
  | { type: "MOVE_SP"; mi: number; zi: number; pi: number; si: number; from: number; to: number }
  // SubSubPrinciple
  | { type: "ADD_SSP"; mi: number; zi: number; pi: number; si: number; spi: number }
  | {
      type: "UPD_SSP";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      qi: number;
      changes: Partial<Pick<SubSubPrinciple, "name" | "action">>;
    }
  | {
      type: "DEL_SSP";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      qi: number;
    }
  | { type: "MOVE_SSP"; mi: number; zi: number; pi: number; si: number; spi: number; from: number; to: number }
  // EssentialSkill
  | {
      type: "ADD_SKILL";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      qi: number;
    }
  | {
      type: "UPD_SKILL";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      qi: number;
      ki: number;
      changes: Partial<EssentialSkill>;
    }
  | {
      type: "DEL_SKILL";
      mi: number;
      zi: number;
      pi: number;
      si: number;
      spi: number;
      qi: number;
      ki: number;
    };

// ─── Helper ──────────────────────────────────────────────────────────
function mapAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item));
}

// ─── Reducer ─────────────────────────────────────────────────────────
function reducer(state: GameModel, action: Action): GameModel {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };

    case "SET_SEASON":
      return {
        ...state,
        season: action.value,
        name: `Modelo de Juego ${action.value}`,
      };

    case "SET_DRAFT":
      return action.draft;

    // ── Principles ────────────────────────────────────────────────
    case "ADD_PRINCIPLE":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: [
              ...z.principles,
              {
                id: nextId(),
                gameMomentId: m.id,
                gameZoneId: z.id,
                order: z.principles.length + 1,
                title: "",
                description: "",
                scenarios: [],
              } satisfies Principle,
            ],
          })),
        })),
      };

    case "UPD_PRINCIPLE":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              ...action.changes,
            })),
          })),
        })),
      };

    case "DEL_PRINCIPLE":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => {
            const filtered = z.principles.filter((_, i) => i !== action.pi);
            return {
              ...z,
              principles: filtered.map((p, i) => ({ ...p, order: i + 1 })),
            };
          }),
        })),
      };

    // ── Scenarios ──────────────────────────────────────────────────
    case "ADD_SCENARIO":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: [
                ...p.scenarios,
                {
                  id: nextId(),
                  order: p.scenarios.length + 1,
                  name: "",
                  context: "",
                  subPrinciples: [],
                } satisfies Scenario,
              ],
            })),
          })),
        })),
      };

    case "UPD_SCENARIO":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                ...action.changes,
              })),
            })),
          })),
        })),
      };

    case "DEL_SCENARIO":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => {
              const filtered = p.scenarios.filter((_, i) => i !== action.si);
              return {
                ...p,
                scenarios: filtered.map((s, i) => ({ ...s, order: i + 1 })),
              };
            }),
          })),
        })),
      };

    case "MOVE_SCENARIO_LOCATION": {
      const sourcePrinciple = state.gameMoments[action.fromMi]?.zones[action.fromZi]?.principles[action.fromPi];
      const moved = sourcePrinciple?.scenarios[action.si];
      if (!moved) return state;

      const withoutMoved: GameModel = {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.fromMi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.fromZi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.fromPi, (p) => {
              const filtered = p.scenarios.filter((_, i) => i !== action.si);
              return { ...p, scenarios: filtered.map((s, i) => ({ ...s, order: i + 1 })) };
            }),
          })),
        })),
      };

      return {
        ...withoutMoved,
        gameMoments: mapAt(withoutMoved.gameMoments, action.toMi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.toZi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.toPi, (p) => ({
              ...p,
              scenarios: [...p.scenarios, { ...moved, order: action.order ?? p.scenarios.length + 1 }],
            })),
          })),
        })),
      };
    }

    // ── SubPrinciples ───────────────────────────────────────────────
    case "ADD_SP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: [
                  ...s.subPrinciples,
                  {
                    id: nextId(),
                    order: s.subPrinciples.length + 1,
                    label: String.fromCharCode(65 + s.subPrinciples.length),
                    name: "",
                    context: "",
                    subSubPrinciples: [],
                  } satisfies SubPrinciple,
                ],
              })),
            })),
          })),
        })),
      };

    case "UPD_SP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  ...action.changes,
                })),
              })),
            })),
          })),
        })),
      };

    case "DEL_SP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => {
                const filtered = s.subPrinciples.filter((_, i) => i !== action.spi);
                return {
                  ...s,
                  subPrinciples: filtered.map((sp, i) => ({
                    ...sp,
                    order: i + 1,
                    label: String.fromCharCode(65 + i),
                  })),
                };
              }),
            })),
          })),
        })),
      };
    case "MOVE_SP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => {
                const items = [...s.subPrinciples];
                const [moved] = items.splice(action.from, 1);
                items.splice(action.to, 0, moved);
                return {
                  ...s,
                  subPrinciples: items.map((sp, i) => ({
                    ...sp,
                    order: i + 1,
                    label: String.fromCharCode(65 + i),
                  })),
                };
              }),
            })),
          })),
        })),
      };
    // ── SubSubPrinciples ────────────────────────────────────────────
    case "ADD_SSP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: [
                    ...sp.subSubPrinciples,
                    {
                      id: nextId(),
                      order: sp.subSubPrinciples.length + 1,
                      name: "",
                      action: "",
                      essentialSkills: [],
                    } satisfies SubSubPrinciple,
                  ],
                })),
              })),
            })),
          })),
        })),
      };

    case "UPD_SSP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: mapAt(sp.subSubPrinciples, action.qi, (ssp) => ({
                    ...ssp,
                    ...action.changes,
                  })),
                })),
              })),
            })),
          })),
        })),
      };

    case "DEL_SSP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: sp.subSubPrinciples.filter(
                    (_, i) => i !== action.qi,
                  ).map((ssp, i) => ({ ...ssp, order: i + 1 })),
                })),
              })),
            })),
          })),
        })),
      };
    case "MOVE_SSP":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => {
                  const items = [...sp.subSubPrinciples];
                  const [moved] = items.splice(action.from, 1);
                  items.splice(action.to, 0, moved);
                  return {
                    ...sp,
                    subSubPrinciples: items.map((ssp, i) => ({ ...ssp, order: i + 1 })),
                  };
                }),
              })),
            })),
          })),
        })),
      };
    // ── EssentialSkills ─────────────────────────────────────────────
    case "ADD_SKILL":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: mapAt(sp.subSubPrinciples, action.qi, (ssp) => ({
                    ...ssp,
                    essentialSkills: [
                      ...ssp.essentialSkills,
                      {
                        id: nextId(),
                        name: "",
                        description: "",
                      } satisfies EssentialSkill,
                    ],
                  })),
                })),
              })),
            })),
          })),
        })),
      };

    case "UPD_SKILL":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: mapAt(sp.subSubPrinciples, action.qi, (ssp) => ({
                    ...ssp,
                    essentialSkills: mapAt(ssp.essentialSkills, action.ki, (sk) => ({
                      ...sk,
                      ...action.changes,
                    })),
                  })),
                })),
              })),
            })),
          })),
        })),
      };

    case "DEL_SKILL":
      return {
        ...state,
        gameMoments: mapAt(state.gameMoments, action.mi, (m) => ({
          ...m,
          zones: mapAt(m.zones, action.zi, (z) => ({
            ...z,
            principles: mapAt(z.principles, action.pi, (p) => ({
              ...p,
              scenarios: mapAt(p.scenarios, action.si, (s) => ({
                ...s,
                subPrinciples: mapAt(s.subPrinciples, action.spi, (sp) => ({
                  ...sp,
                  subSubPrinciples: mapAt(sp.subSubPrinciples, action.qi, (ssp) => ({
                    ...ssp,
                    essentialSkills: ssp.essentialSkills.filter(
                      (_, i) => i !== action.ki,
                    ),
                  })),
                })),
              })),
            })),
          })),
        })),
      };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────
interface DraftContextValue {
  draft: GameModel;
  dispatch: React.Dispatch<Action>;
}

const GameModelDraftContext = createContext<DraftContextValue | null>(null);

export function GameModelDraftProvider({
  initialDraft,
  children,
}: {
  initialDraft: GameModel;
  children: ReactNode;
}) {
  const [draft, dispatch] = useReducer(reducer, initialDraft);
  return (
    <GameModelDraftContext.Provider value={{ draft, dispatch }}>
      {children}
    </GameModelDraftContext.Provider>
  );
}

export function useGameModelDraft(): DraftContextValue {
  const ctx = useContext(GameModelDraftContext);
  if (!ctx)
    throw new Error("useGameModelDraft must be used within GameModelDraftProvider");
  return ctx;
}
