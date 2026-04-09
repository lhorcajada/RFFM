export type PlayerRating = {
  id: string;
  teamPlayerId: string;
  isGoalkeeper?: boolean | null;
  // Computed aggregates
  technical: number;
  tactical: number;
  physical: number;
  competitiveness: number;
  // Physical sub-ratings (field player)
  physicalSpeed?: number | null;
  physicalEndurance?: number | null;
  physicalStrength?: number | null;
  // Technical sub-ratings (field player)
  technicalDribbling?: number | null;
  technicalPassing?: number | null;
  technicalControl?: number | null;
  technicalShooting?: number | null;
  technicalTackling?: number | null;
  technicalInterceptions?: number | null;
  technicalHeading?: number | null;
  // Tactical sub-ratings (field player)
  tacticalDefensiveAwareness?: number | null;
  tacticalMarking?: number | null;
  tacticalTrackBack?: number | null;
  tacticalPressing?: number | null;
  tacticalGeneratesAdvantage?: number | null;
  tacticalOffMovement?: number | null;
  tacticalBeatsOpponents?: number | null;
  tacticalAttackParticipation?: number | null;
  // Competitiveness sub-ratings (field player)
  competDuelWinning?: number | null;
  competLooseBalls?: number | null;
  competRecoveries?: number | null;
  competDecisiveActions?: number | null;
  competResponsibility?: number | null;
  competConstantEffort?: number | null;
  // Goalkeeper physical sub-ratings
  keeperReactionSpeed?: number | null;
  keeperAgility?: number | null;
  keeperJumpPower?: number | null;
  keeperStrength?: number | null;
  keeperEndurance?: number | null;
  // Goalkeeper technical sub-ratings
  keeperHandSecurity?: number | null;
  keeperSaves?: number | null;
  keeperAerialPlay?: number | null;
  keeperHandDistribution?: number | null;
  keeperKickDistribution?: number | null;
  keeperFirstTouch?: number | null;
  keeperPlayUnderPressure?: number | null;
  // Goalkeeper tactical sub-ratings
  keeperPositioning?: number | null;
  keeperGameReading?: number | null;
  keeperOneOnOne?: number | null;
  keeperBackCoverage?: number | null;
  keeperSallyTiming?: number | null;
  keeperBuildupPlay?: number | null;
  keeperDefensiveOrganization?: number | null;
  // Goalkeeper competitiveness sub-ratings
  keeperValor?: number | null;
  keeperConcentration?: number | null;
  keeperKeyMoments?: number | null;
  keeperErrorManagement?: number | null;
  keeperResponsibility?: number | null;
  keeperConsistency?: number | null;
  ratedAt: string;
  notes?: string | null;
};
