using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Competitions.Services;
using RFFM.Api.Features.Competitions.Models;
using Microsoft.AspNetCore.Mvc;

namespace RFFM.Api.Features.Competitions.Queries
{
    public class GetCalendar : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            // Return all jornadas (omit jornada)
            app.MapGet("/calendar", async (IMediator mediator, CancellationToken cancellationToken, int season = 21, int competition = 25255269, int group= 25255283, int playType=1) =>
            {
                var request = new QueryAll(season, competition, group, playType);
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName(nameof(GetCalendar))
            .WithTags("Competitions")
            .Produces<Calendar?>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);

            // Return single jornada
            app.MapGet("/calendar/jornada", async (IMediator mediator, CancellationToken cancellationToken, int temporada, int competicion, int grupo, int jornada, int tipojuego) =>
            {
                var request = new QuerySingle(temporada, competicion, grupo, jornada, tipojuego);
                var response = await mediator.Send(request, cancellationToken);
                return response != null ? Results.Ok(response) : Results.NotFound();
            })
            .WithName("GetCalendarJornada")
            .WithTags("Competitions")
            .Produces<Calendar?>()
            .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }

        public record QueryAll(int Temporada, int Competicion, int Grupo, int TipoJuego) : Common.IQuery<Calendar?>;
        public record QuerySingle(int Temporada, int Competicion, int Grupo, int Jornada, int TipoJuego) : Common.IQuery<Calendar?>;

        public class RequestHandlerAll : IRequestHandler<QueryAll, Calendar?>
        {
            private readonly ICalendarService _calendarService;

            public RequestHandlerAll(ICalendarService calendarService)
            {
                _calendarService = calendarService;
            }

            public async ValueTask<Calendar?> Handle(QueryAll request, CancellationToken cancellationToken)
            {
                // request all jornadas -> pass null for jornada
                var result = await _calendarService.GetCalendarAsync(request.Temporada, request.Competicion, request.Grupo, null, request.TipoJuego, cancellationToken);
                return result;
            }
        }

        public class RequestHandlerSingle : IRequestHandler<QuerySingle, Calendar?>
        {
            private readonly ICalendarService _calendarService;

            public RequestHandlerSingle(ICalendarService calendarService)
            {
                _calendarService = calendarService;
            }

            public async ValueTask<Calendar?> Handle(QuerySingle request, CancellationToken cancellationToken)
            {
                var result = await _calendarService.GetCalendarAsync(request.Temporada, request.Competicion, request.Grupo, request.Jornada, request.TipoJuego, cancellationToken);
                return result;
            }
        }
    }
}
