namespace RFFM.Api.Features.Federation.Teams.Queries.Responses
{
    public class GoalSectorsResponse
    {
        public string? TeamCode { get; set; } = string.Empty;
        public string? TeamName { get; set; } = string.Empty;
        public int MatchesProcessed { get; set; }
        public List<Sector> Sectors { get; set; } = new();
        public int TotalGoalsFor { get; set; }
        public int TotalGoalsAgainst { get; set; }
    }
    public class Sector
    {
        public int StartMinute { get; set; }
        public int EndMinute { get; set; }
        public int GoalsFor { get; set; }
        public int GoalsAgainst { get; set; }

    }

}
