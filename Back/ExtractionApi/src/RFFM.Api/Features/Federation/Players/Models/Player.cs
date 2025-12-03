namespace RFFM.Api.Features.Federation.Players.Models;

public class Player
{
    public string PlayerId { get; set; } = string.Empty;
    public string SeasonId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Age { get; set; }
    public int BirthYear { get; set; }
    public string Team { get; set; } = string.Empty;
    public string TeamCode { get; set; } = string.Empty;
    public string TeamCategory { get; set; } = string.Empty;
    public string JerseyNumber { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public bool IsGoalkeeper { get; set; }
    public string PhotoUrl { get; set; } = string.Empty;
    public string TeamShieldUrl { get; set; } = string.Empty;
    public MatchStatistics Matches { get; set; } = new();
    public CardStatistics Cards { get; set; } = new();
    public List<CompetitionParticipation> Competitions { get; set; } = new();
}
