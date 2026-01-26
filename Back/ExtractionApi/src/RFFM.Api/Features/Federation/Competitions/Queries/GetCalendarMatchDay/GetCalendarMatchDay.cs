using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries.GetCalendarMatchDay
{
    public class FederationGetCalendarMatchDay : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/calendar/matchday",
                    async (IMediator mediator,
                        CancellationToken cancellationToken,
                        int groupId,
                        int round,
                        int season = 21,
                        int playType = 1) =>
                    {
                        if (round <= 0)
                            return Results.Problem("round debe ser mayor que 0", statusCode: StatusCodes.Status400BadRequest);

                        var request = new QueryCalendarMatchDay(groupId, round);
                        var response = await mediator.Send(request, cancellationToken);
                        return Results.Ok(response);
                    })
                .WithName(nameof(FederationGetCalendarMatchDay))
                .WithTags(CompetitionsConstants.CompetitionsFeature)
                .Produces<CalendarMatchDayWithRoundsResponse>()
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization();
        }

        public record QueryCalendarMatchDay(int GroupId, int Round)
            : Common.IQueryApp<CalendarMatchDayWithRoundsResponse>;

        public class Handler(ICalendarService calendarService)
            : IRequestHandler<QueryCalendarMatchDay, CalendarMatchDayWithRoundsResponse>
        {
            public async ValueTask<CalendarMatchDayWithRoundsResponse> Handle(QueryCalendarMatchDay request,
                CancellationToken cancellationToken)
            {
                return await calendarService.GetCalendarMatchDayAsync(
                    request.GroupId,
                    request.Round,
                    cancellationToken);
            }
        }
    }
}
