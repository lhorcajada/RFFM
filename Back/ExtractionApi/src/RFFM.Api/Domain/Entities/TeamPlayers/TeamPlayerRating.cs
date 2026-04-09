namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamPlayerRating : BaseEntity
    {
        public string TeamPlayerId { get; private set; } = null!;

        // Computed aggregates (average of sub-ratings)
        public decimal Technical { get; private set; }
        public decimal Tactical { get; private set; }
        public decimal Physical { get; private set; }
        public decimal Competitiveness { get; private set; }

        // Physical sub-ratings
        public decimal? PhysicalSpeed { get; private set; }
        public decimal? PhysicalEndurance { get; private set; }
        public decimal? PhysicalStrength { get; private set; }

        // Technical sub-ratings
        public decimal? TechnicalDribbling { get; private set; }
        public decimal? TechnicalPassing { get; private set; }
        public decimal? TechnicalControl { get; private set; }
        public decimal? TechnicalShooting { get; private set; }
        public decimal? TechnicalTackling { get; private set; }
        public decimal? TechnicalInterceptions { get; private set; }
        public decimal? TechnicalHeading { get; private set; }

        // Tactical sub-ratings
        public decimal? TacticalDefensiveAwareness { get; private set; }
        public decimal? TacticalMarking { get; private set; }
        public decimal? TacticalTrackBack { get; private set; }
        public decimal? TacticalPressing { get; private set; }
        public decimal? TacticalGeneratesAdvantage { get; private set; }
        public decimal? TacticalOffMovement { get; private set; }
        public decimal? TacticalBeatsOpponents { get; private set; }
        public decimal? TacticalAttackParticipation { get; private set; }

        // Competitiveness sub-ratings
        public decimal? CompetDuelWinning { get; private set; }
        public decimal? CompetLooseBalls { get; private set; }
        public decimal? CompetRecoveries { get; private set; }
        public decimal? CompetDecisiveActions { get; private set; }
        public decimal? CompetResponsibility { get; private set; }
        public decimal? CompetConstantEffort { get; private set; }

        // Goalkeeper flag
        public bool IsGoalkeeper { get; private set; }

        // Goalkeeper Physical sub-ratings
        public decimal? KeeperReactionSpeed { get; private set; }
        public decimal? KeeperAgility { get; private set; }
        public decimal? KeeperJumpPower { get; private set; }
        public decimal? KeeperStrength { get; private set; }
        public decimal? KeeperEndurance { get; private set; }

        // Goalkeeper Technical sub-ratings
        public decimal? KeeperHandSecurity { get; private set; }
        public decimal? KeeperSaves { get; private set; }
        public decimal? KeeperAerialPlay { get; private set; }
        public decimal? KeeperHandDistribution { get; private set; }
        public decimal? KeeperKickDistribution { get; private set; }
        public decimal? KeeperFirstTouch { get; private set; }
        public decimal? KeeperPlayUnderPressure { get; private set; }

        // Goalkeeper Tactical sub-ratings
        public decimal? KeeperPositioning { get; private set; }
        public decimal? KeeperGameReading { get; private set; }
        public decimal? KeeperOneOnOne { get; private set; }
        public decimal? KeeperBackCoverage { get; private set; }
        public decimal? KeeperSallyTiming { get; private set; }
        public decimal? KeeperBuildupPlay { get; private set; }
        public decimal? KeeperDefensiveOrganization { get; private set; }

        // Goalkeeper Competitiveness sub-ratings
        public decimal? KeeperValor { get; private set; }
        public decimal? KeeperConcentration { get; private set; }
        public decimal? KeeperKeyMoments { get; private set; }
        public decimal? KeeperErrorManagement { get; private set; }
        public decimal? KeeperResponsibility { get; private set; }
        public decimal? KeeperConsistency { get; private set; }

        public DateTime RatedAt { get; private set; }
        public string? Notes { get; private set; }

        public TeamPlayer TeamPlayer { get; private set; } = null!;

        private TeamPlayerRating() { }

        public static TeamPlayerRating Create(
            string teamPlayerId,
            decimal physicalSpeed,
            decimal physicalEndurance,
            decimal physicalStrength,
            decimal technicalDribbling,
            decimal technicalPassing,
            decimal technicalControl,
            decimal technicalShooting,
            decimal technicalTackling,
            decimal technicalInterceptions,
            decimal technicalHeading,
            decimal tacticalDefensiveAwareness,
            decimal tacticalMarking,
            decimal tacticalTrackBack,
            decimal tacticalPressing,
            decimal tacticalGeneratesAdvantage,
            decimal tacticalOffMovement,
            decimal tacticalBeatsOpponents,
            decimal tacticalAttackParticipation,
            decimal competDuelWinning,
            decimal competLooseBalls,
            decimal competRecoveries,
            decimal competDecisiveActions,
            decimal competResponsibility,
            decimal competConstantEffort,
            string? notes = null)
        {
            decimal[] physicalSubs = [physicalSpeed, physicalEndurance, physicalStrength];
            decimal[] technicalSubs = [technicalDribbling, technicalPassing, technicalControl, technicalShooting, technicalTackling, technicalInterceptions, technicalHeading];
            decimal[] tacticalSubs = [tacticalDefensiveAwareness, tacticalMarking, tacticalTrackBack, tacticalPressing, tacticalGeneratesAdvantage, tacticalOffMovement, tacticalBeatsOpponents, tacticalAttackParticipation];
            decimal[] competSubs = [competDuelWinning, competLooseBalls, competRecoveries, competDecisiveActions, competResponsibility, competConstantEffort];

            foreach (var (value, name) in new[]
            {
                (physicalSpeed, "physicalSpeed"), (physicalEndurance, "physicalEndurance"), (physicalStrength, "physicalStrength"),
                (technicalDribbling, "technicalDribbling"), (technicalPassing, "technicalPassing"), (technicalControl, "technicalControl"),
                (technicalShooting, "technicalShooting"), (technicalTackling, "technicalTackling"), (technicalInterceptions, "technicalInterceptions"),
                (technicalHeading, "technicalHeading"), (tacticalDefensiveAwareness, "tacticalDefensiveAwareness"),
                (tacticalMarking, "tacticalMarking"), (tacticalTrackBack, "tacticalTrackBack"), (tacticalPressing, "tacticalPressing"),
                (tacticalGeneratesAdvantage, "tacticalGeneratesAdvantage"), (tacticalOffMovement, "tacticalOffMovement"),
                (tacticalBeatsOpponents, "tacticalBeatsOpponents"), (tacticalAttackParticipation, "tacticalAttackParticipation"),
                (competDuelWinning, "competDuelWinning"), (competLooseBalls, "competLooseBalls"),
                (competRecoveries, "competRecoveries"), (competDecisiveActions, "competDecisiveActions"),
                (competResponsibility, "competResponsibility"), (competConstantEffort, "competConstantEffort"),
            })
            {
                ValidateSubRating(value, name);
            }

            return new TeamPlayerRating
            {
                TeamPlayerId = teamPlayerId,
                PhysicalSpeed = physicalSpeed,
                PhysicalEndurance = physicalEndurance,
                PhysicalStrength = physicalStrength,
                TechnicalDribbling = technicalDribbling,
                TechnicalPassing = technicalPassing,
                TechnicalControl = technicalControl,
                TechnicalShooting = technicalShooting,
                TechnicalTackling = technicalTackling,
                TechnicalInterceptions = technicalInterceptions,
                TechnicalHeading = technicalHeading,
                TacticalDefensiveAwareness = tacticalDefensiveAwareness,
                TacticalMarking = tacticalMarking,
                TacticalTrackBack = tacticalTrackBack,
                TacticalPressing = tacticalPressing,
                TacticalGeneratesAdvantage = tacticalGeneratesAdvantage,
                TacticalOffMovement = tacticalOffMovement,
                TacticalBeatsOpponents = tacticalBeatsOpponents,
                TacticalAttackParticipation = tacticalAttackParticipation,
                CompetDuelWinning = competDuelWinning,
                CompetLooseBalls = competLooseBalls,
                CompetRecoveries = competRecoveries,
                CompetDecisiveActions = competDecisiveActions,
                CompetResponsibility = competResponsibility,
                CompetConstantEffort = competConstantEffort,
                Physical = Math.Round(physicalSubs.Average(), 1),
                Technical = Math.Round(technicalSubs.Average(), 1),
                Tactical = Math.Round(tacticalSubs.Average(), 1),
                Competitiveness = Math.Round(competSubs.Average(), 1),
                RatedAt = DateTime.UtcNow,
                Notes = notes
            };
        }

        private static void ValidateSubRating(decimal value, string field)
        {
            if (value < 0 || value > 100)
                throw new ArgumentException($"La subvaloración de '{field}' debe estar entre 0 y 100.");
            if (value != Math.Floor(value))
                throw new ArgumentException($"La subvaloración de '{field}' debe ser un número entero.");
        }

        public static TeamPlayerRating CreateForGoalkeeper(
            string teamPlayerId,
            decimal keeperReactionSpeed,
            decimal keeperAgility,
            decimal keeperJumpPower,
            decimal keeperStrength,
            decimal keeperEndurance,
            decimal keeperHandSecurity,
            decimal keeperSaves,
            decimal keeperAerialPlay,
            decimal keeperHandDistribution,
            decimal keeperKickDistribution,
            decimal keeperFirstTouch,
            decimal keeperPlayUnderPressure,
            decimal keeperPositioning,
            decimal keeperGameReading,
            decimal keeperOneOnOne,
            decimal keeperBackCoverage,
            decimal keeperSallyTiming,
            decimal keeperBuildupPlay,
            decimal keeperDefensiveOrganization,
            decimal keeperValor,
            decimal keeperConcentration,
            decimal keeperKeyMoments,
            decimal keeperErrorManagement,
            decimal keeperResponsibility,
            decimal keeperConsistency,
            string? notes = null)
        {
            decimal[] physicalSubs = [keeperReactionSpeed, keeperAgility, keeperJumpPower, keeperStrength, keeperEndurance];
            decimal[] technicalSubs = [keeperHandSecurity, keeperSaves, keeperAerialPlay, keeperHandDistribution, keeperKickDistribution, keeperFirstTouch, keeperPlayUnderPressure];
            decimal[] tacticalSubs = [keeperPositioning, keeperGameReading, keeperOneOnOne, keeperBackCoverage, keeperSallyTiming, keeperBuildupPlay, keeperDefensiveOrganization];
            decimal[] competSubs = [keeperValor, keeperConcentration, keeperKeyMoments, keeperErrorManagement, keeperResponsibility, keeperConsistency];

            foreach (var (value, name) in new[]
            {
                (keeperReactionSpeed, "keeperReactionSpeed"), (keeperAgility, "keeperAgility"), (keeperJumpPower, "keeperJumpPower"),
                (keeperStrength, "keeperStrength"), (keeperEndurance, "keeperEndurance"),
                (keeperHandSecurity, "keeperHandSecurity"), (keeperSaves, "keeperSaves"), (keeperAerialPlay, "keeperAerialPlay"),
                (keeperHandDistribution, "keeperHandDistribution"), (keeperKickDistribution, "keeperKickDistribution"),
                (keeperFirstTouch, "keeperFirstTouch"), (keeperPlayUnderPressure, "keeperPlayUnderPressure"),
                (keeperPositioning, "keeperPositioning"), (keeperGameReading, "keeperGameReading"), (keeperOneOnOne, "keeperOneOnOne"),
                (keeperBackCoverage, "keeperBackCoverage"), (keeperSallyTiming, "keeperSallyTiming"),
                (keeperBuildupPlay, "keeperBuildupPlay"), (keeperDefensiveOrganization, "keeperDefensiveOrganization"),
                (keeperValor, "keeperValor"), (keeperConcentration, "keeperConcentration"), (keeperKeyMoments, "keeperKeyMoments"),
                (keeperErrorManagement, "keeperErrorManagement"), (keeperResponsibility, "keeperResponsibility"), (keeperConsistency, "keeperConsistency"),
            })
            {
                ValidateSubRating(value, name);
            }

            return new TeamPlayerRating
            {
                TeamPlayerId = teamPlayerId,
                IsGoalkeeper = true,
                KeeperReactionSpeed = keeperReactionSpeed,
                KeeperAgility = keeperAgility,
                KeeperJumpPower = keeperJumpPower,
                KeeperStrength = keeperStrength,
                KeeperEndurance = keeperEndurance,
                KeeperHandSecurity = keeperHandSecurity,
                KeeperSaves = keeperSaves,
                KeeperAerialPlay = keeperAerialPlay,
                KeeperHandDistribution = keeperHandDistribution,
                KeeperKickDistribution = keeperKickDistribution,
                KeeperFirstTouch = keeperFirstTouch,
                KeeperPlayUnderPressure = keeperPlayUnderPressure,
                KeeperPositioning = keeperPositioning,
                KeeperGameReading = keeperGameReading,
                KeeperOneOnOne = keeperOneOnOne,
                KeeperBackCoverage = keeperBackCoverage,
                KeeperSallyTiming = keeperSallyTiming,
                KeeperBuildupPlay = keeperBuildupPlay,
                KeeperDefensiveOrganization = keeperDefensiveOrganization,
                KeeperValor = keeperValor,
                KeeperConcentration = keeperConcentration,
                KeeperKeyMoments = keeperKeyMoments,
                KeeperErrorManagement = keeperErrorManagement,
                KeeperResponsibility = keeperResponsibility,
                KeeperConsistency = keeperConsistency,
                Physical = Math.Round(physicalSubs.Average(), 1),
                Technical = Math.Round(technicalSubs.Average(), 1),
                Tactical = Math.Round(tacticalSubs.Average(), 1),
                Competitiveness = Math.Round(competSubs.Average(), 1),
                RatedAt = DateTime.UtcNow,
                Notes = notes
            };
        }
    }
}
