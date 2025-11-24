using RFFM.Api.Features.Teams.Models;
using RFFM.Api.Features.Teams.Queries.Responses;

namespace RFFM.Api.Features.Teams.Services
{
    public interface IGoalSectorsAggregator
    {
        // Aggregates goals for two team codes. Returns responses for team1 and team2 in that order.
        Task<(GoalSectorsResponse team1, GoalSectorsResponse team2)> AggregateAsync(
            string teamCode1,
            string teamCode2,
            int matchTime,
            int sectorsPerHalf,
            List<RFFM.Api.Features.Competitions.Queries.GetCalendar.Responses.MatchResponse> matches,
            Func<string, Task<MatchRffm?>> fetchActa,
            CancellationToken cancellationToken);
    }
}