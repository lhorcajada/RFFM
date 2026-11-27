import type { ProposalHistoryData } from "../components/ProposalHistory";
import type { DeconvokeProposal, ProposalDecision } from "./deconvokeProposal";
import { roleLabel, type PositionRole } from "./positionRequirements";
import { buildProposalHistory } from "./proposalHistory";

export type ProposalSort = "order" | "fewest" | "longestNoTechnical";

export type ProposalSearchCriteria = {
  text: string;
  neverOut: boolean;
  noTechnical: boolean;
  sort: ProposalSort;
};

export const DEFAULT_CRITERIA: ProposalSearchCriteria = { text: "", neverOut: false, noTechnical: false, sort: "order" };

export type ProposalSituation = "out" | "protected" | "notChosen" | "alreadyOut";

export type ProposalSearchResult = {
  playerId: string;
  name: string;
  position: string;
  situation: ProposalSituation;
};

export function isSearching({ text, neverOut, noTechnical, sort }: ProposalSearchCriteria): boolean {
  return text.trim() !== "" || neverOut || noTechnical || sort !== "order";
}

const SITUATION_OF_GROUP: Record<ProposalDecision["group"], ProposalSituation> = {
  proposed: "out",
  protected: "protected",
  notChosen: "notChosen",
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function entry(
  playerId: string,
  name: string,
  role: PositionRole | null,
  situation: ProposalSituation,
): ProposalSearchResult {
  return { playerId, name, position: roleLabel(role), situation };
}

/** Every player of the proposal once: the deconvocation order first, then the rest and the already deconvoked. */
function proposalEntries({ players, alreadyDeconvoked, order }: DeconvokeProposal): ProposalSearchResult[] {
  const rank = new Map(order.map((o) => [o.playerId, o.rank]));
  const rankOf = (playerId: string) => rank.get(playerId) ?? Number.MAX_SAFE_INTEGER;
  return [
    ...players
      .map((p) => entry(p.playerId, p.displayName, p.positionRole, SITUATION_OF_GROUP[p.decision.group]))
      .sort((a, b) => rankOf(a.playerId) - rankOf(b.playerId)),
    ...alreadyDeconvoked.map((p) => entry(p.playerId, p.displayName, p.positionRole, "alreadyOut")),
  ];
}

/** Players of the proposal that meet the search; every figure counts league matches only. */
export function searchProposal(
  proposal: DeconvokeProposal,
  { columns, grid }: ProposalHistoryData,
  { text, neverOut, noTechnical, sort }: ProposalSearchCriteria,
): ProposalSearchResult[] {
  const wanted = normalize(text);
  const matches = proposalEntries(proposal)
    .map((result) => ({ result, history: buildProposalHistory(result.playerId, columns, grid) }))
    .filter(
      ({ result, history }) =>
        (!wanted || normalize(result.name).includes(wanted)) &&
        (!neverOut || history.total === 0) &&
        (!noTechnical || history.technical === 0),
    );

  // Array sort is stable: ties keep the order of the proposal.
  if (sort === "fewest") {
    matches.sort((a, b) => a.history.total - b.history.total || a.history.technical - b.history.technical);
  } else if (sort === "longestNoTechnical") {
    matches.sort((a, b) => b.history.streak - a.history.streak);
  }
  return matches.map(({ result }) => result);
}
