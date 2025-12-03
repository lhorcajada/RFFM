using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries.Responses;

namespace RFFM.Api.Features.Federation.Teams.Services
{
    public interface IGoalSectorsAggregator
    {
        // Aggregates goals for two team codes. Returns responses for team1 and team2 in that order.
        Task<(GoalSectorsResponse team1, GoalSectorsResponse team2)> AggregateAsync(
            string teamCode1,
            string teamCode2,
            int matchTime,
            int sectorsPerHalf,
            List<MatchResponse> matches,
            Func<string, Task<MatchRffm?>> fetchActa,
            CancellationToken cancellationToken);
    }
}