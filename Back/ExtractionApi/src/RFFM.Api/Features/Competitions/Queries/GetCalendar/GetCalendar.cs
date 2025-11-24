using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Competitions.Services;

namespace RFFM.Api.Features.Competitions.Queries.GetCalendar
{
    public class GetCalendar : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/calendar", async (IMediator mediator, CancellationToken cancellationToken, int competitionId = 25255269, int groupId = 25255283) =>
            {
                var request = new QueryCalendar(competitionId, groupId);
                var response = await mediator.Send(request, cancellationToken);
                return Results.Ok(response);
            })
            .WithName(nameof(GetCalendar))
            .WithTags("Competitions")
            .Produces<CalendarResponse>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);

        }

        public record QueryCalendar(int Competition, int GroupId) : Common.IQuery<CalendarResponse>;

        public class RequestHandlerAll(ICalendarService calendarService)
            : IRequestHandler<QueryCalendar, CalendarResponse>
        {
            public async ValueTask<CalendarResponse> Handle(QueryCalendar request, CancellationToken cancellationToken)
            {
                var result = await calendarService.GetCalendarAsync(request.Competition, request.GroupId,  cancellationToken);
                return result;
            }
        }

    }
}
