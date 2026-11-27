import { describe, expect, it } from "vitest";
import type { GridCell, MatchColumn } from "../../components/convocationMatchDetail.types";
import type { DeconvokeProposal, PlayerProposal, ProposalDecision } from "../deconvokeProposal";
import { DEFAULT_CRITERIA, isSearching, searchProposal, type ProposalSearchCriteria } from "../proposalSearch";

const TECHNICAL: GridCell = { statusId: 5, excuseTypeId: null, statusName: "Deconvoke", excuseName: null };
const INJURY: GridCell = { statusId: 5, excuseTypeId: 1, statusName: "Deconvoke", excuseName: "Lesión" };

/** Newest first, as the grid delivers them. */
const columns: MatchColumn[] = [
  { eventId: "f1", label: "Amist. · 1 nov", date: "2026-11-01", rival: null, isLeague: false },
  { eventId: "j3", label: "J3 · 18 oct", date: "2026-10-18", rival: null, isLeague: true },
  { eventId: "j2", label: "J2 · 11 oct", date: "2026-10-11", rival: null, isLeague: true },
  { eventId: "j1", label: "J1 · 4 oct", date: "2026-10-04", rival: null, isLeague: true },
];

// alvaro: only a friendly. bruno: one injury (J1). carlos: technical J3 and J2. dario: technical J1.
const grid = new Map([
  ["f1", new Map([["alvaro", TECHNICAL]])],
  ["j3", new Map([["carlos", TECHNICAL]])],
  ["j2", new Map([["carlos", TECHNICAL]])],
  ["j1", new Map([["bruno", INJURY], ["dario", TECHNICAL]])],
]);

function player(playerId: string, displayName: string, group: ProposalDecision["group"]): PlayerProposal {
  return { playerId, displayName, positionRole: "centreBack", decision: { group, reason: "" } } as PlayerProposal;
}

const proposal = {
  players: [
    player("bruno", "Bruno", "protected"),
    player("carlos", "Carlos", "notChosen"),
    player("alvaro", "Álvaro", "proposed"),
  ],
  alreadyDeconvoked: [{ playerId: "dario", displayName: "Darío", position: null, positionRole: "fullBack" }],
  order: [
    { rank: 1, playerId: "alvaro", name: "Álvaro" },
    { rank: 2, playerId: "carlos", name: "Carlos" },
  ],
} as unknown as DeconvokeProposal;

function search(criteria: Partial<ProposalSearchCriteria>) {
  return searchProposal(proposal, { columns, grid }, { ...DEFAULT_CRITERIA, ...criteria });
}

const ids = (criteria: Partial<ProposalSearchCriteria>) => search(criteria).map((r) => r.playerId);

describe("searchProposal", () => {
  it("lista cada jugador una sola vez, siguiendo el orden de la propuesta", () => {
    expect(ids({})).toEqual(["alvaro", "carlos", "bruno", "dario"]);
  });

  it("indica la situación de cada jugador en la propuesta", () => {
    expect(search({}).map((r) => r.situation)).toEqual(["out", "notChosen", "protected", "alreadyOut"]);
  });

  it("busca por parte del nombre sin distinguir mayúsculas ni tildes", () => {
    expect(ids({ text: "  ALVA " })).toEqual(["alvaro"]);
    expect(ids({ text: "rio" })).toEqual(["dario"]);
  });

  it("«nunca desconvocados» solo cuenta la liga y excluye cualquier motivo", () => {
    expect(ids({ neverOut: true })).toEqual(["alvaro"]);
  });

  it("«sin decisión técnica» mantiene a quien solo ha faltado por lesión", () => {
    expect(ids({ noTechnical: true })).toEqual(["alvaro", "bruno"]);
  });

  it("combina el nombre con los filtros", () => {
    expect(ids({ text: "bru", noTechnical: true })).toEqual(["bruno"]);
    expect(ids({ text: "bru", neverOut: true })).toEqual([]);
  });

  it("ordena por menos desconvocatorias y desempata por decisiones técnicas", () => {
    expect(ids({ sort: "fewest" })).toEqual(["alvaro", "bruno", "dario", "carlos"]);
  });

  it("ordena por más jornadas sin decisión técnica y respeta el orden de la propuesta en los empates", () => {
    // alvaro and bruno: 3 matchdays; dario: 2; carlos: 0.
    expect(ids({ sort: "longestNoTechnical" })).toEqual(["alvaro", "bruno", "dario", "carlos"]);
  });
});

describe("isSearching", () => {
  it("es falso con los valores por defecto o con el texto en blanco", () => {
    expect(isSearching(DEFAULT_CRITERIA)).toBe(false);
    expect(isSearching({ ...DEFAULT_CRITERIA, text: "  " })).toBe(false);
  });

  it.each<Partial<ProposalSearchCriteria>>([{ text: "a" }, { neverOut: true }, { noTechnical: true }, { sort: "fewest" }])(
    "es cierto con %o",
    (criteria) => {
      expect(isSearching({ ...DEFAULT_CRITERIA, ...criteria })).toBe(true);
    },
  );
});
