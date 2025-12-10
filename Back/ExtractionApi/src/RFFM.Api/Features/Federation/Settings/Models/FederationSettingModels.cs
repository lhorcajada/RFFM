namespace RFFM.Api.Features.Federation.Settings.Models
{
    public record SaveFederationSettingRequest(
        string? CompetitionId,
        string? CompetitionName,
        string? GroupId,
        string? GroupName,
        string? TeamId,
        string? TeamName,
        bool IsPrimary = false);

    public record FederationSettingResponse(
        string Id,
        string? CompetitionId,
        string? CompetitionName,
        string? GroupId,
        string? GroupName,
        string? TeamId,
        string? TeamName,
        long CreatedAt,
        bool IsPrimary);

    public static class FederationSettingMapping
    {
        public static FederationSettingResponse ToResponse(
            RFFM.Api.Domain.Entities.Federation.FederationSetting setting)
        {
            return new FederationSettingResponse(
                setting.Id,
                setting.CompetitionId,
                setting.CompetitionName,
                setting.GroupId,
                setting.GroupName,
                setting.TeamId,
                setting.TeamName,
                setting.CreatedAt,
                setting.IsPrimary);
        }
    }
}
