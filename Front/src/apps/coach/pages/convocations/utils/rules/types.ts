import type { BuildProposalInput, WeeklyTrainingStats, ProposalFactor, DeconvokeProposal } from '../deconvokeProposal';
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PlayerRating } from "../../../../types/playerRating";
import type { MatchColumn, GridCell } from '../../components/convocationMatchDetail.types';
import type { SeasonPlayerStats } from '../../components/simulation/liveMatch.types';

export type RuleContext = {
  input: BuildProposalInput;
  playerId: string;
  player: PlayerResponse;
  displayName: string;
  weightedRating: number;
  competitiveness: number;
  physical: number;
  tactical: number;
  technical: number;
  necessity: number;
  weekStats: WeeklyTrainingStats;
  effectiveStreak: number;
  technicalTotal: number;
  injuryAbsencesInStreak: number;
  calledCount: number;
  startsCount: number;
  startsDataAvailable: boolean;
  minRequiredCalls: number;
  calledIds: string[];
  positionGroupCounts: Map<string, number>;
  playerById: Map<string, PlayerResponse>;
  ratings: Record<string, PlayerRating>;
  previousRivalResult: DeconvokeProposal['previousRivalResult'];
  seasonColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
  lastInjuryEndMap: Map<string, string | null>;
  currentIso: string | null;
  weekTrainingCount: number;
  maxTechnicalTotal: number;
  seasonPlayerStats?: SeasonPlayerStats | null;
};

export type RuleResult = {
  factors: ProposalFactor[];
  delta: number;
  forced?: boolean;
};

export type Rule = (ctx: RuleContext, prev: Record<string, RuleResult>) => RuleResult;
