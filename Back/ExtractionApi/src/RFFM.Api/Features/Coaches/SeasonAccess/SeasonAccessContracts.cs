using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public record SeasonAccessDemarcationDto(int Id, string Name, string Code);

    public record SeasonAccessPlayerDto(
        string Id,
        string FederationPlayerCode,
        string PlayerName,
        string TeamCode,
        string TeamName,
        string Category,
        int? BirthYear,
        IReadOnlyCollection<int> PossibleDemarcationIds,
        int? IdealDemarcationId,
        int? TotalGoals);

    public record SeasonAccessTrialDto(
        string Id,
        string SeasonId,
        string Category,
        IReadOnlyCollection<SeasonAccessPlayerDto> Players);

    public record SeasonAccessTrialDayDto(
        string Id,
        string TrialId,
        DateOnly Date,
        string? Label);

    public record SeasonAccessTrialDayRatingDto(
        string Id,
        string TrialDayId,
        string TrialPlayerId,
        decimal? Score,
        string? Notes,
        string? Status,
        int? IdealDemarcationId,
        IReadOnlyCollection<int> PossibleDemarcationIds,
        int? TotalGoals);

    public record UpsertSeasonAccessPlayerRequest(
        string SeasonId,
        string Category,
        string FederationPlayerCode,
        string PlayerName,
        string TeamCode,
        string TeamName,
        int? BirthYear,
        IReadOnlyCollection<int>? PossibleDemarcationIds,
        int? IdealDemarcationId,
        int? TotalGoals);

    public record CreateSeasonAccessTrialDayRequest(
        string SeasonId,
        string Category,
        DateOnly Date,
        string? Label);

    public record UpdateSeasonAccessTrialDayRequest(
        DateOnly Date,
        string? Label);

    public record UpsertSeasonAccessTrialDayRatingRequest(
        string TrialPlayerId,
        decimal? Score,
        string? Notes,
        string? Status,
        int? IdealDemarcationId,
        IReadOnlyCollection<int>? PossibleDemarcationIds,
        int? TotalGoals);

    internal static class SeasonAccessMappings
    {
        public static SeasonAccessTrialDto ToDto(this SeasonAccessTrial trial)
        {
            return new SeasonAccessTrialDto(
                trial.Id,
                trial.SeasonId,
                trial.Category,
                trial.Players
                    .OrderBy(player => player.BirthYear ?? int.MaxValue)
                    .ThenBy(player => player.PlayerName, StringComparer.OrdinalIgnoreCase)
                    .Select(player => player.ToDto())
                    .ToList());
        }

        public static SeasonAccessPlayerDto ToDto(this SeasonAccessTrialPlayer player)
        {
            return new SeasonAccessPlayerDto(
                player.Id,
                player.FederationPlayerCode,
                player.PlayerName,
                player.TeamCode,
                player.TeamName,
                player.Category,
                player.BirthYear,
                player.PossibleDemarcationIds,
                player.IdealDemarcationId,
                player.TotalGoals);
        }

        public static SeasonAccessTrialDayDto ToDto(this SeasonAccessTrialDay day)
        {
            return new SeasonAccessTrialDayDto(
                day.Id,
                day.TrialId,
                day.Date,
                day.Label);
        }

        public static SeasonAccessTrialDayRatingDto ToDto(this SeasonAccessTrialDayRating rating)
        {
            return new SeasonAccessTrialDayRatingDto(
                rating.Id,
                rating.TrialDayId,
                rating.TrialPlayerId,
                rating.Score,
                rating.Notes,
                rating.Status,
                rating.IdealDemarcationId,
                rating.PossibleDemarcationIds,
                rating.TotalGoals);
        }

        public static SeasonAccessDemarcationDto ToDto(this RFFM.Api.Domain.Entities.Demarcations.DemarcationMaster demarcation)
        {
            return new SeasonAccessDemarcationDto(demarcation.Id, demarcation.Name, demarcation.Code);
        }
    }
}
