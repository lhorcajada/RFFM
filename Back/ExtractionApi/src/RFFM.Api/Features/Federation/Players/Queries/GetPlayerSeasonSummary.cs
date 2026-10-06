using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.Players.Services;
using RFFM.Api.Features.Federation.Seasons.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Players.Queries
{
    public class GetPlayerSeasonSummary : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/players/{id}/season-summary",
                    async (string id, int? season, IMediator mediator, IOptions<RffmOptions> rffmOptions,
                        CancellationToken cancellationToken) =>
                    {
                        var seasonId = season ?? rffmOptions.Value.CurrentSeasonId;
                        var response = await mediator.Send(new QueryApp(id, seasonId), cancellationToken);
                        return Results.Ok(response);
                    })
                .RequireAuthorization()
                .WithName(nameof(GetPlayerSeasonSummary))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<PlayerSeasonSummary[]>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryApp(string PlayerId, int SeasonId) : IRequest<PlayerSeasonSummary[]>;

        public record PlayerSeasonTeam(string CompetitionName, string GroupName, string TeamName,
            int TeamPoints, int TeamPosition, string? TeamShieldUrl);

        public record PlayerSeasonSummary(int SeasonId, string SeasonName, SeasonStats Stats,
            IReadOnlyList<PlayerSeasonTeam> Teams);

        public class Handler(IPlayerService playerService, IOptions<RffmOptions> rffmOptions, IMemoryCache cache)
            : IRequestHandler<QueryApp, PlayerSeasonSummary[]>
        {
            public async ValueTask<PlayerSeasonSummary[]> Handle(QueryApp request, CancellationToken cancellationToken)
            {
                var seasons = new[] { request.SeasonId, RffmSeasons.Previous(rffmOptions.Value, request.SeasonId) }
                    .Where(s => s.HasValue)
                    .Select(s => s!.Value);

                var sheets = await Task.WhenAll(seasons.Select(async season => (
                    season,
                    sheet: await cache.GetPlayerSheetOrDefaultAsync(playerService, request.PlayerId, season, cancellationToken))));

                return sheets
                    .Where(s => HasActivity(s.sheet))
                    .OrderByDescending(s => s.season)
                    .Select(s => new PlayerSeasonSummary(
                        s.season,
                        RffmSeasons.Label(rffmOptions.Value, s.season),
                        SeasonStats.From(s.sheet!),
                        s.sheet!.Competitions
                            .Select(c => new PlayerSeasonTeam(c.CompetitionName, c.GroupName, c.TeamName,
                                c.TeamPoints, c.TeamPosition, string.IsNullOrWhiteSpace(c.TeamShieldUrl) ? null : c.TeamShieldUrl))
                            .ToList()))
                    .ToArray();
            }

            private static bool HasActivity(Player? sheet)
                => sheet is not null && (sheet.Competitions.Count > 0 || sheet.Matches.Called > 0);
        }
    }
}
