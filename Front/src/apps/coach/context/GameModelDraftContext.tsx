import { createContext, useContext, useReducer, type ReactNode } from "react";
import type {
  GameModel,
  Principle,
  Subprincipio,
  Zona,
  SubSubPrincipio,
  Habilidad,
  Nota,
  SetPieceRule,
  OpenIssue,
} from "../types/gameModel";

// ─── Temp-ID counter (negatives = unsaved) ───────────────────────────
let _idCounter = -1;
const nextId = () => _idCounter--;

// ─── Addressing ──────────────────────────────────────────────────────
// A SubSubPrincipio hangs either off a Zona (zi set) or directly off a
// Subprincipio (zi omitted) — never both, per spec §0.
type NotaLevel = "principle" | "subprincipio" | "zona" | "ssp";

// ─── Actions ─────────────────────────────────────────────────────────
type Action =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_SEASON"; value: string }
  | { type: "SET_DRAFT"; draft: GameModel }
  // Principle
  | { type: "ADD_PRINCIPLE"; gameMomentId: number }
  | { type: "UPD_PRINCIPLE"; pi: number; changes: Partial<Pick<Principle, "titulo" | "texto" | "numero" | "gameMomentId">> }
  | { type: "DEL_PRINCIPLE"; pi: number }
  // Subprincipio
  | { type: "ADD_SUBPRINCIPIO"; pi: number }
  | { type: "UPD_SUBPRINCIPIO"; pi: number; spi: number; changes: Partial<Pick<Subprincipio, "titulo" | "texto" | "numero">> }
  | { type: "DEL_SUBPRINCIPIO"; pi: number; spi: number }
  // Zona
  | { type: "ADD_ZONA"; pi: number; spi: number }
  | { type: "UPD_ZONA"; pi: number; spi: number; zi: number; changes: Partial<Pick<Zona, "zoneKeys" | "label" | "zonaTexto" | "texto">> }
  | { type: "DEL_ZONA"; pi: number; spi: number; zi: number }
  // SubSubPrincipio
  | { type: "ADD_SSP"; pi: number; spi: number; zi?: number }
  | { type: "UPD_SSP"; pi: number; spi: number; zi?: number; sspi: number; changes: Partial<Pick<SubSubPrincipio, "numero" | "rol" | "texto">> }
  | { type: "DEL_SSP"; pi: number; spi: number; zi?: number; sspi: number }
  // Habilidad
  | { type: "ADD_HABILIDAD"; pi: number; spi: number; zi?: number; sspi: number }
  | { type: "UPD_HABILIDAD"; pi: number; spi: number; zi?: number; sspi: number; hi: number; changes: Partial<Pick<Habilidad, "nombre" | "descripcion" | "entrenable" | "referenciaAKey">> }
  | { type: "DEL_HABILIDAD"; pi: number; spi: number; zi?: number; sspi: number; hi: number }
  // Nota
  | { type: "ADD_NOTA"; level: NotaLevel; pi: number; spi?: number; zi?: number; sspi?: number }
  | { type: "UPD_NOTA"; level: NotaLevel; pi: number; spi?: number; zi?: number; sspi?: number; ni: number; changes: Partial<Pick<Nota, "tipo" | "texto">> }
  | { type: "DEL_NOTA"; level: NotaLevel; pi: number; spi?: number; zi?: number; sspi?: number; ni: number }
  // SetPieceRule (flat)
  | { type: "ADD_SET_PIECE_RULE" }
  | { type: "UPD_SET_PIECE_RULE"; i: number; changes: Partial<Pick<SetPieceRule, "subtype" | "texto">> }
  | { type: "DEL_SET_PIECE_RULE"; i: number }
  // OpenIssue (flat)
  | { type: "ADD_OPEN_ISSUE" }
  | { type: "UPD_OPEN_ISSUE"; i: number; changes: Partial<Pick<OpenIssue, "topic" | "description" | "status">> }
  | { type: "DEL_OPEN_ISSUE"; i: number };

// ─── Helpers ─────────────────────────────────────────────────────────
function mapAt<T>(arr: T[], idx: number, fn: (item: T) => T): T[] {
  return arr.map((item, i) => (i === idx ? fn(item) : item));
}

function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

function updatePrinciple(state: GameModel, pi: number, fn: (p: Principle) => Principle): GameModel {
  return { ...state, principles: mapAt(state.principles, pi, fn) };
}

function updateSubprincipio(
  state: GameModel,
  pi: number,
  spi: number,
  fn: (sp: Subprincipio) => Subprincipio
): GameModel {
  return updatePrinciple(state, pi, (p) => ({ ...p, subprincipios: mapAt(p.subprincipios, spi, fn) }));
}

/** Updates the SubSubPrincipio array a Zona or a Subprincipio owns directly (mutually exclusive). */
function updateSspContainer(sp: Subprincipio, zi: number | undefined, fn: (list: SubSubPrincipio[]) => SubSubPrincipio[]): Subprincipio {
  if (zi === undefined) {
    return { ...sp, subSubPrincipios: fn(sp.subSubPrincipios) };
  }
  return { ...sp, zonas: mapAt(sp.zonas, zi, (z) => ({ ...z, subSubPrincipios: fn(z.subSubPrincipios) })) };
}

function updateSsp(
  state: GameModel,
  pi: number,
  spi: number,
  zi: number | undefined,
  sspi: number,
  fn: (ssp: SubSubPrincipio) => SubSubPrincipio
): GameModel {
  return updateSubprincipio(state, pi, spi, (sp) => updateSspContainer(sp, zi, (list) => mapAt(list, sspi, fn)));
}

function emptyNota(): Nota {
  return { id: nextId(), tipo: "nota", texto: "" };
}

function updateNotas(list: Nota[], fn: (list: Nota[]) => Nota[]): Nota[] {
  return fn(list);
}

// ─── Reducer ─────────────────────────────────────────────────────────
function reducer(state: GameModel, action: Action): GameModel {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };

    case "SET_SEASON":
      return { ...state, season: action.value, name: `Modelo de Juego ${action.value}` };

    case "SET_DRAFT":
      return action.draft;

    // ── Principles ────────────────────────────────────────────────
    case "ADD_PRINCIPLE":
      return {
        ...state,
        principles: [
          ...state.principles,
          {
            id: nextId(),
            gameMomentId: action.gameMomentId,
            numero: state.principles.filter((p) => p.gameMomentId === action.gameMomentId).length + 1,
            titulo: "",
            texto: "",
            subprincipios: [],
            notas: [],
          } satisfies Principle,
        ],
      };

    case "UPD_PRINCIPLE":
      return updatePrinciple(state, action.pi, (p) => ({ ...p, ...action.changes }));

    case "DEL_PRINCIPLE":
      return { ...state, principles: removeAt(state.principles, action.pi) };

    // ── Subprincipios ────────────────────────────────────────────
    case "ADD_SUBPRINCIPIO":
      return updatePrinciple(state, action.pi, (p) => ({
        ...p,
        subprincipios: [
          ...p.subprincipios,
          { id: nextId(), numero: "", titulo: "", texto: "", zonas: [], subSubPrincipios: [], notas: [] } satisfies Subprincipio,
        ],
      }));

    case "UPD_SUBPRINCIPIO":
      return updateSubprincipio(state, action.pi, action.spi, (sp) => ({ ...sp, ...action.changes }));

    case "DEL_SUBPRINCIPIO":
      return updatePrinciple(state, action.pi, (p) => ({
        ...p,
        subprincipios: removeAt(p.subprincipios, action.spi),
      }));

    // ── Zonas ─────────────────────────────────────────────────────
    case "ADD_ZONA":
      return updateSubprincipio(state, action.pi, action.spi, (sp) => ({
        ...sp,
        zonas: [
          ...sp.zonas,
          { id: nextId(), zoneKeys: [], label: null, zonaTexto: null, texto: "", subSubPrincipios: [], notas: [] } satisfies Zona,
        ],
      }));

    case "UPD_ZONA":
      return updateSubprincipio(state, action.pi, action.spi, (sp) => ({
        ...sp,
        zonas: mapAt(sp.zonas, action.zi, (z) => ({ ...z, ...action.changes })),
      }));

    case "DEL_ZONA":
      return updateSubprincipio(state, action.pi, action.spi, (sp) => ({
        ...sp,
        zonas: removeAt(sp.zonas, action.zi),
      }));

    // ── SubSubPrincipios ─────────────────────────────────────────
    case "ADD_SSP":
      return updateSubprincipio(state, action.pi, action.spi, (sp) =>
        updateSspContainer(sp, action.zi, (list) => [
          ...list,
          { id: nextId(), numero: "", rol: "", texto: "", habilidades: [], notas: [] } satisfies SubSubPrincipio,
        ])
      );

    case "UPD_SSP":
      return updateSsp(state, action.pi, action.spi, action.zi, action.sspi, (ssp) => ({ ...ssp, ...action.changes }));

    case "DEL_SSP":
      return updateSubprincipio(state, action.pi, action.spi, (sp) =>
        updateSspContainer(sp, action.zi, (list) => removeAt(list, action.sspi))
      );

    // ── Habilidades ──────────────────────────────────────────────
    case "ADD_HABILIDAD":
      return updateSsp(state, action.pi, action.spi, action.zi, action.sspi, (ssp) => ({
        ...ssp,
        habilidades: [
          ...ssp.habilidades,
          { id: nextId(), nombre: "", descripcion: "", entrenable: "", referenciaAKey: null } satisfies Habilidad,
        ],
      }));

    case "UPD_HABILIDAD":
      return updateSsp(state, action.pi, action.spi, action.zi, action.sspi, (ssp) => ({
        ...ssp,
        habilidades: mapAt(ssp.habilidades, action.hi, (h) => ({ ...h, ...action.changes })),
      }));

    case "DEL_HABILIDAD":
      return updateSsp(state, action.pi, action.spi, action.zi, action.sspi, (ssp) => ({
        ...ssp,
        habilidades: removeAt(ssp.habilidades, action.hi),
      }));

    // ── Notas (anchored per level) ──────────────────────────────
    case "ADD_NOTA": {
      switch (action.level) {
        case "principle":
          return updatePrinciple(state, action.pi, (p) => ({ ...p, notas: [...p.notas, emptyNota()] }));
        case "subprincipio":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            notas: [...sp.notas, emptyNota()],
          }));
        case "zona":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            zonas: mapAt(sp.zonas, action.zi as number, (z) => ({ ...z, notas: [...z.notas, emptyNota()] })),
          }));
        case "ssp":
          return updateSsp(state, action.pi, action.spi as number, action.zi, action.sspi as number, (ssp) => ({
            ...ssp,
            notas: [...ssp.notas, emptyNota()],
          }));
        default:
          return state;
      }
    }

    case "UPD_NOTA": {
      switch (action.level) {
        case "principle":
          return updatePrinciple(state, action.pi, (p) => ({
            ...p,
            notas: updateNotas(p.notas, (list) => mapAt(list, action.ni, (n) => ({ ...n, ...action.changes }))),
          }));
        case "subprincipio":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            notas: updateNotas(sp.notas, (list) => mapAt(list, action.ni, (n) => ({ ...n, ...action.changes }))),
          }));
        case "zona":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            zonas: mapAt(sp.zonas, action.zi as number, (z) => ({
              ...z,
              notas: updateNotas(z.notas, (list) => mapAt(list, action.ni, (n) => ({ ...n, ...action.changes }))),
            })),
          }));
        case "ssp":
          return updateSsp(state, action.pi, action.spi as number, action.zi, action.sspi as number, (ssp) => ({
            ...ssp,
            notas: updateNotas(ssp.notas, (list) => mapAt(list, action.ni, (n) => ({ ...n, ...action.changes }))),
          }));
        default:
          return state;
      }
    }

    case "DEL_NOTA": {
      switch (action.level) {
        case "principle":
          return updatePrinciple(state, action.pi, (p) => ({ ...p, notas: removeAt(p.notas, action.ni) }));
        case "subprincipio":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            notas: removeAt(sp.notas, action.ni),
          }));
        case "zona":
          return updateSubprincipio(state, action.pi, action.spi as number, (sp) => ({
            ...sp,
            zonas: mapAt(sp.zonas, action.zi as number, (z) => ({ ...z, notas: removeAt(z.notas, action.ni) })),
          }));
        case "ssp":
          return updateSsp(state, action.pi, action.spi as number, action.zi, action.sspi as number, (ssp) => ({
            ...ssp,
            notas: removeAt(ssp.notas, action.ni),
          }));
        default:
          return state;
      }
    }

    // ── SetPieceRule (flat) ─────────────────────────────────────
    case "ADD_SET_PIECE_RULE":
      return {
        ...state,
        setPieceRules: [...state.setPieceRules, { id: nextId(), subtype: "", texto: "" } satisfies SetPieceRule],
      };

    case "UPD_SET_PIECE_RULE":
      return { ...state, setPieceRules: mapAt(state.setPieceRules, action.i, (s) => ({ ...s, ...action.changes })) };

    case "DEL_SET_PIECE_RULE":
      return { ...state, setPieceRules: removeAt(state.setPieceRules, action.i) };

    // ── OpenIssue (flat) ─────────────────────────────────────────
    case "ADD_OPEN_ISSUE":
      return {
        ...state,
        openIssues: [
          ...state.openIssues,
          { id: nextId(), topic: "", description: "", status: "open" } satisfies OpenIssue,
        ],
      };

    case "UPD_OPEN_ISSUE":
      return { ...state, openIssues: mapAt(state.openIssues, action.i, (o) => ({ ...o, ...action.changes })) };

    case "DEL_OPEN_ISSUE":
      return { ...state, openIssues: removeAt(state.openIssues, action.i) };

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
  if (!ctx) throw new Error("useGameModelDraft must be used within GameModelDraftProvider");
  return ctx;
}
