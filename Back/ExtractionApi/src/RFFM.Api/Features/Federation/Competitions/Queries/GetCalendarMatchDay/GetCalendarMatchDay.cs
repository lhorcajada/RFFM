using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Options;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;

namespace RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay
{
    public class FederationGetCalendarMatchDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/calendar/matchday",
                    async (IMediator mediator,
                        IOptions<RffmOptions> rffmOptions,
                        CancellationToken cancellationToken,
                        int groupId,
                        int round,
                        int? season = null,
                        int playType = 1) =>
                    {
                        if (round <= 0)
                            return Results.Problem("round debe ser mayor que 0", statusCode: StatusCodes.Status400BadRequest);

                        var request = new QueryCalendarMatchDay(groupId, round, season ?? rffmOptions.Value.CurrentSeasonId);
                        var response = await mediator.Send(request, cancellationToken);
                        return Results.Ok(response);
                    })
                .WithName(nameof(FederationGetCalendarMatchDay))
                .WithTags(CompetitionsConstants.CompetitionsFeature)
                .Produces<CalendarMatchDayWithRoundsResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        /// <summary>
        /// No es <c>IQueryApp</c>: lee de la BD y la actualiza desde la RFFM cuando faltan datos, así que no
        /// debe pasar por el <c>CachingBehavior</c>.
        /// </summary>
        public record QueryCalendarMatchDay(int GroupId, int Round, int Season)
            : IRequest<CalendarMatchDayWithRoundsResponse>;

        public class Handler(IRffmResultsSyncService resultsSyncService)
            : IRequestHandler<QueryCalendarMatchDay, CalendarMatchDayWithRoundsResponse>
        {
            public async ValueTask<CalendarMatchDayWithRoundsResponse> Handle(QueryCalendarMatchDay request,
                CancellationToken cancellationToken)
            {
                return await resultsSyncService.GetMatchDayAsync(request.GroupId, request.Round, request.Season,
                    cancellationToken);
            }
        }
    }
}
