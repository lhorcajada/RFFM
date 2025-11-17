namespace RFFM.Api.Features.Players.Models;

public class MatchStatistics
{
    public int Called { get; set; }
    public int Starter { get; set; }
    public int Substitute { get; set; }
    public int Played { get; set; }
    public int TotalGoals { get; set; }
    public decimal GoalsPerMatch { get; set; }
}
