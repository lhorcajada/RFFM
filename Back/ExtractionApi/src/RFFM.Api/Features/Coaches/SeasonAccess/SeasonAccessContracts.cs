using RFFM.Api.Domain.Entities.SeasonAccess;

namespace RFFM.Api.Features.Coaches.SeasonAccess
{
    public record SeasonAccessDemarcationDto(int Id, string Name, string Code);

   
    public record SeasonAccessTrialDto(
        string Id,
        string SeasonId,
        string Category,
        IReadOnlyCollection<SeasonAccessTrialPlayerDto> Players);

    public record SeasonAccessTrialDayDto(
        string Id,
        string TrialId,
        DateOnly Date,
        string? Label);

    public record SeasonAccessTrialPlayerDto(
        string Id,
        string TrialDayId,
        decimal? Score,
        string? Notes,
        int? IdealDemarcationId,
        IReadOnlyCollection<int> PossibleDemarcationIds,
        int? TotalGoals,
        string? Status,
        int? BirthYear,
        string? Category,
        string? TeamCode,
        string? TeamName,
        string? FederationPlayerCode,
        string? PlayerName,
        DateOnly? RemovedFromDate);

    public record UpsertSeasonAccessPlayerRequest(
        string SeasonId,
        string Category,
        string? DivisionCategory,
        string FederationPlayerCode,
        string PlayerName,
        string TeamCode,
        string TeamName,
        int? BirthYear,
        IReadOnlyCollection<int>? PossibleDemarcationIds,
        int? IdealDemarcationId,
        int? TotalGoals,
        string? Status,
        decimal? Score,
        string? Notes,
        string? TrialDayId);

    public record CreateSeasonAccessTrialDayRequest(
        string SeasonId,
        string GeneralCategory,
        DateOnly Date,
        string? Label);

    public record UpdateSeasonAccessTrialDayRequest(
        DateOnly Date,
        string? Label);

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

        public static SeasonAccessTrialPlayerDto ToDto(this SeasonAccessTrialPlayer player)
        {
            return new SeasonAccessTrialPlayerDto(
                player.Id,
                player.TrialDayId ?? string.Empty,
                player.Score,
                player.Notes,
                player.IdealDemarcationId,
                player.PossibleDemarcationIds,
                player.TotalGoals,
                player.Status,
                player.BirthYear,
                player.Category,
                player.TeamCode,
                player.TeamName,
                player.FederationPlayerCode,
                player.PlayerName,
                player.RemovedFromDate);

        }

        public static SeasonAccessTrialDayDto ToDto(this SeasonAccessTrialDay day)
        {
            return new SeasonAccessTrialDayDto(
                day.Id,
                day.TrialId,
                day.Date,
                day.Label);
        }

        public static SeasonAccessDemarcationDto ToDto(Domain.Entities.Demarcations.DemarcationMaster demarcation)
        {
            return new SeasonAccessDemarcationDto(demarcation.Id, demarcation.Name, demarcation.Code);
        }
    }
}
