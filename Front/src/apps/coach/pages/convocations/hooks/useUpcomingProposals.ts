import { useMemo } from "react";
import type { DeconvokeProposal } from "../utils/deconvokeProposal";
import type { UpcomingMatch } from "../utils/rivalDifficulty";
import { simulateUpcomingProposals, type SimulatedProposal } from "../utils/simulateUpcomingProposals";
import { toBuildProposalInput, type UseConvocationProposalInput } from "./useConvocationProposal";

type UseUpcomingProposalsInput = {
  /** The same inputs the real proposal was built from. */
  proposalInput: UseConvocationProposalInput;
  /** The real proposal for the match being prepared: assumed applied before the first estimate. */
  proposal: DeconvokeProposal;
  upcomingMatches: UpcomingMatch[];
  /** Estimated recovery date of the players injured today. */
  injuryReturn: ReadonlyMap<string, string | null>;
  /** Estimates are only computed while the proposal is on screen. */
  enabled: boolean;
};

/** Estimated proposals for the next league matches, chained from the real one. */
export function useUpcomingProposals({
  proposalInput,
  proposal,
  upcomingMatches,
  injuryReturn,
  enabled,
}: UseUpcomingProposalsInput): SimulatedProposal[] {
  return useMemo(() => {
    if (!enabled || upcomingMatches.length === 0 || proposal.players.length === 0) return [];
    return simulateUpcomingProposals({
      base: toBuildProposalInput(proposalInput),
      baseProposal: proposal,
      matches: upcomingMatches,
      injuryReturn,
    });
    // `proposal` is rebuilt whenever any of the proposal inputs changes, so it stands for them here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, proposal, upcomingMatches, injuryReturn]);
}
