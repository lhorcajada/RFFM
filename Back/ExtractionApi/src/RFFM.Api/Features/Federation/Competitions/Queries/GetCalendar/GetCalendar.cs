using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;

namespace RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar
{
    public class FederationGetCalendar : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/calendar", async (IMediator mediator, CancellationToken cancellationToken, int season = 21, int competitionId = 25255269, int groupId = 25255283, int playType = 1) =>
            {
                var request = new QueryAppCalendar(competitionId, groupId);
                var response = await mediator.Send(request, cancellationToken);
                return Results.Ok(response);
            })
            .WithName(nameof(FederationGetCalendar))
            .WithTags(CompetitionsConstants.CompetitionsFeature)
            .Produces<CalendarResponse>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);

        }

        public record QueryAppCalendar(int Competition, int GroupId) : Common.IQueryApp<CalendarResponse>;

        public class RequestHandlerAll(ICalendarService calendarService)
            : IRequestHandler<QueryAppCalendar, CalendarResponse>
        {
            public async ValueTask<CalendarResponse> Handle(QueryAppCalendar request, CancellationToken cancellationToken)
            {
                var result = await calendarService.GetCalendarAsync(request.Competition, request.GroupId,  cancellationToken);
                return result;
            }
        }

    }
}
