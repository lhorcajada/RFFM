namespace RFFM.Api.Features.Players.Models;

public class CompetitionParticipation
{
    public string CompetitionName { get; set; } = string.Empty;
    public string CompetitionCode { get; set; } = string.Empty;
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string TeamCode { get; set; } = string.Empty;
    public string TeamName { get; set; } = string.Empty;
    public string ClubName { get; set; } = string.Empty;
    public int TeamPosition { get; set; }
    public int TeamPoints { get; set; }
    public string TeamShieldUrl { get; set; } = string.Empty;
    public bool ShowStatistics { get; set; }
}
