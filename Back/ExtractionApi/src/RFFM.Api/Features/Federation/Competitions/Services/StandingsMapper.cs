using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;

namespace RFFM.Api.Features.Federation.Competitions.Services
{
    public static class StandingsMapper
    {
        public static List<TeamResponse> ToTeams(StandingRffm standings) =>
            (standings.Classification ?? [])
                .Select(d => new TeamResponse
                {
                    Color = d.Color?.Trim() ?? string.Empty,
                    Position = d.Position?.Trim() ?? string.Empty,
                    ImageUrl = d.ImageUrl?.Trim() ?? string.Empty,
                    TeamId = d.TeamId?.Trim() ?? string.Empty,
                    TeamName = d.TeamName?.Trim() ?? string.Empty,
                    Played = d.Played?.Trim() ?? string.Empty,
                    Won = d.Won?.Trim() ?? string.Empty,
                    Lost = d.Lost?.Trim() ?? string.Empty,
                    Drawn = d.Drawn?.Trim() ?? string.Empty,
                    Penalties = d.Penalties?.Trim() ?? string.Empty,
                    GoalsFor = d.GoalsFor?.Trim() ?? string.Empty,
                    GoalsAgainst = d.GoalsAgainst?.Trim() ?? string.Empty,
                    HomePlayed = d.HomePlayed?.Trim() ?? string.Empty,
                    HomeWon = d.HomeWon?.Trim() ?? string.Empty,
                    HomeDrawn = d.HomeDrawn?.Trim() ?? string.Empty,
                    HomePenaltyWins = d.HomePenaltyWins?.Trim() ?? string.Empty,
                    HomeLost = d.HomeLost?.Trim() ?? string.Empty,
                    AwayPlayed = d.AwayPlayed?.Trim() ?? string.Empty,
                    AwayWon = d.AwayWon?.Trim() ?? string.Empty,
                    AwayDrawn = d.AwayDrawn?.Trim() ?? string.Empty,
                    AwayPenaltyWins = d.AwayPenaltyWins?.Trim() ?? string.Empty,
                    AwayLost = d.AwayLost?.Trim() ?? string.Empty,
                    Points = d.Points?.Trim() ?? string.Empty,
                    SanctionPoints = d.SanctionPoints?.Trim() ?? string.Empty,
                    HomePoints = d.HomePoints?.Trim() ?? string.Empty,
                    AwayPoints = d.AwayPoints?.Trim() ?? string.Empty,
                    ShowCoefficient = d.ShowCoefficient?.Trim() ?? string.Empty,
                    Coefficient = d.Coefficient?.Trim() ?? string.Empty,
                    MatchStreaks = d.MatchStreaks?.Select(ms => new MatchStreakResponse
                    {
                        Type = ms.Type?.Trim() ?? string.Empty
                    }).ToList() ?? []
                })
                .ToList();
    }
}
