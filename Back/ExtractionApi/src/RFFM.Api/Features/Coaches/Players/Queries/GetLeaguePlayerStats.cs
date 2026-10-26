using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using System.Text.Json;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    /// <summary>
    /// Returns, per player on a team, goals, call-ups, starts, yellow/red cards and minutes
    /// counting only finished league matches (friendlies and tournaments are excluded).
    /// See openspec/changes/squad-league-stats/design.md.
    /// </summary>
    public class GetLeaguePlayerStats : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(
                    "/api/catalog/team/{teamId}/league-stats",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query { TeamId = teamId }, ct)))
                .WithName(nameof(GetLeaguePlayerStats))
                .WithTags("Coaches")
                .Produces<List<LeaguePlayerStatsDto>>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record Query : IQueryApp<List<LeaguePlayerStatsDto>>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string FeatureRoute => CoachFeatureRoutes.Squad;
            public string RequiredPermission => "Read";
        }

        public record LeaguePlayerStatsDto(
            string TeamPlayerId,
            int Goals,
            int CallUps,
            int Starts,
            int YellowCards,
            int RedCards,
            int MinutesPlayed);

        public record ParticipationRow(
            string TeamPlayerId,
            int MinutesPlayed,
            bool IsStarter,
            string? GoalsJson,
            string? CardsJson);

        public record ConvocationRow(string TeamPlayerId, int? ConvocationStatusId);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<Query, List<LeaguePlayerStatsDto>>
        {
            public async ValueTask<List<LeaguePlayerStatsDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var teamPlayerIds = await db.TeamPlayers
                    .AsNoTracking()
                    .Where(tp => tp.TeamId == request.TeamId)
                    .OrderBy(tp => tp.Player.Name)
                    .ThenBy(tp => tp.Player.LastName)
                    .Select(tp => tp.Id)
                    .ToListAsync(cancellationToken);

                var leagueEventTypeId = SportEventsConstants.MatchEventTypeId;
                var finishedLeagueEventIds = await db.SportEvents
                    .AsNoTracking()
                    .Where(se => se.TeamId == request.TeamId
                                 && se.EventTypeId == leagueEventTypeId
                                 && se.EveDateTime != null && se.EveDateTime < DateTime.UtcNow)
                    .Select(se => se.Id)
                    .ToListAsync(cancellationToken);

                var participations = await db.MatchParticipations
                    .AsNoTracking()
                    .Where(mp => finishedLeagueEventIds.Contains(mp.EventId) && mp.MatchPhase == "finished")
                    .Select(mp => new ParticipationRow(mp.TeamPlayerId, mp.MinutesPlayed, mp.IsStarter, mp.GoalsJson, mp.CardsJson))
                    .ToListAsync(cancellationToken);

                var convocations = await db.Convocations
                    .AsNoTracking()
                    .Where(c => finishedLeagueEventIds.Contains(c.SportEventId))
                    .Select(c => new ConvocationRow(c.TeamPlayerId, c.ConvocationStatusId))
                    .ToListAsync(cancellationToken);

                return Calculator.Calculate(teamPlayerIds, participations, convocations);
            }
        }

        // ─── Pure aggregation (unit-tested without a database) ────────────────

        public static class Calculator
        {
            public const int PendingStatusId = 1;
            public const int AcceptedStatusId = 2;
            public const int DeconvokeStatusId = 5;

            public static List<LeaguePlayerStatsDto> Calculate(
                IReadOnlyList<string> teamPlayerIds,
                IReadOnlyList<ParticipationRow> participations,
                IReadOnlyList<ConvocationRow> convocations)
            {
                var participationsByPlayer = participations.ToLookup(p => p.TeamPlayerId);
                var callUpsByPlayer = convocations
                    .Where(c => c.ConvocationStatusId != DeconvokeStatusId)
                    .ToLookup(c => c.TeamPlayerId);

                return teamPlayerIds
                    .Select(id =>
                    {
                        var own = participationsByPlayer[id].ToList();
                        return new LeaguePlayerStatsDto(
                            id,
                            own.Sum(p => CountGoals(p.GoalsJson, id)),
                            callUpsByPlayer[id].Count(),
                            own.Count(p => p.IsStarter),
                            own.Sum(p => PlayerCardCountService.CountCards(p.CardsJson, id, "Yellow")),
                            own.Sum(p => PlayerCardCountService.CountCards(p.CardsJson, id, "Red")),
                            own.Sum(p => p.MinutesPlayed));
                    })
                    .ToList();
            }

            private static int CountGoals(string? goalsJson, string teamPlayerId)
            {
                if (string.IsNullOrEmpty(goalsJson)) return 0;

                try
                {
                    using var doc = JsonDocument.Parse(goalsJson);
                    if (doc.RootElement.ValueKind != JsonValueKind.Array) return 0;

                    return doc.RootElement.EnumerateArray().Count(goal =>
                        goal.TryGetProperty("isOwnTeam", out var own) && own.GetBoolean()
                        && goal.TryGetProperty("scorerId", out var scorer) && scorer.GetString() == teamPlayerId);
                }
                catch (JsonException)
                {
                    return 0;
                }
            }
        }
    }
}
