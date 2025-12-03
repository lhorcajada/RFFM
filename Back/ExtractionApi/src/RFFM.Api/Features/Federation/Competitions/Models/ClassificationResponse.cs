namespace RFFM.Api.Features.Federation.Competitions.Models
{
    public class ClassificationResponse
    {
        public List<TeamResponse> Teams { get; set; } = new();
    }

    public class TeamResponse
    {
        public string Color { get; set; } = string.Empty;

        public string Position { get; set; } = string.Empty;

        public string ImageUrl { get; set; } = string.Empty;

        public string TeamId { get; set; } = string.Empty;

        public string TeamName { get; set; } = string.Empty;

        public string Played { get; set; } = string.Empty;

        public string Won { get; set; } = string.Empty;

        public string Lost { get; set; } = string.Empty;

        public string Drawn { get; set; } = string.Empty;

        public string Penalties { get; set; } = string.Empty;

        public string GoalsFor { get; set; } = string.Empty;

        public string GoalsAgainst { get; set; } = string.Empty;

        public string HomePlayed { get; set; } = string.Empty;

        public string HomeWon { get; set; } = string.Empty;

        public string HomeDrawn { get; set; } = string.Empty;

        public string HomePenaltyWins { get; set; } = string.Empty;

        public string HomeLost { get; set; } = string.Empty;

        public string AwayPlayed { get; set; } = string.Empty;

        public string AwayWon { get; set; } = string.Empty;

        public string AwayDrawn { get; set; } = string.Empty;

        public string AwayPenaltyWins { get; set; } = string.Empty;

        public string AwayLost { get; set; } = string.Empty;

        public string Points { get; set; } = string.Empty;

        public string SanctionPoints { get; set; } = string.Empty;

        public string HomePoints { get; set; } = string.Empty;

        public string AwayPoints { get; set; } = string.Empty;

        public string ShowCoefficient { get; set; } = string.Empty;

        public string Coefficient { get; set; } = string.Empty;

        public List<MatchStreakResponse> MatchStreaks { get; set; } = new();

    }

    public class MatchStreakResponse
    {
        //G = Ganado, P = Perdido, E = Empatado
        public string Type { get; set; } = string.Empty;

    }
}
