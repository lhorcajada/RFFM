using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Queries
{
    public class GetSportEvents : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/sport-events/{teamId}",
                    async (string teamId, int pageNumber, int pageSize, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new SportEventsQuery { TeamId = teamId, PageNumber = pageNumber, PageSize = pageSize}, cancellationToken);
                    })
                .WithName(nameof(GetSportEvents))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SportEventResponse[]>();
        }

        public record SportEventsQuery : IQueryApp<SportEventResponse[]>
        {
            public string TeamId { get; set; } = null!;
            public int PageNumber { get; set; } // Página actual
            public int PageSize { get; set; }// Tamaño de la página
            public string CacheKey => $"SportEvents_{TeamId}_{PageNumber}_{PageSize}";
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }


        public record SportEventResponse()
        {
            public string Id { get; set; } = null!;
            public string Name { get; set; } = null!;
            public DateTime EveDateTime { get; set; }
            public DateTime StartTime { get; set; }
            public DateTime? EndTime { get; set; }
            public DateTime? ArrivalDate { get; set; }
            public string? Location { get; set; }
            public string? Description { get; set; }
            public int EventTypeId { get; set; }
            public string TeamId { get; set; } = null!;
            public string? RivalId { get; set; }

        };

        public class GetSportEventsRequestHandler : IRequestHandler<SportEventsQuery, SportEventResponse[]>
        {
            private readonly AppDbContext _db;

            public GetSportEventsRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<SportEventResponse[]> Handle(SportEventsQuery request, CancellationToken cancellationToken = default)
            {
                return await _db.SportEvents
                    .Include(s=> s.Rival)
                    .Where(e => e.TeamId == request.TeamId)
                    .OrderBy(s => s.EveDateTime)
                    .Skip((request.PageNumber - 1) * request.PageSize) // Salta registros según la página
                    .Take(request.PageSize) // Toma solo el tamaño especificado
                    .Select(sportEvent => new SportEventResponse
                    {
                        Id = sportEvent.Id,
                        Name = sportEvent.Name,
                        EveDateTime = sportEvent.EveDateTime,
                        StartTime = sportEvent.StartTime,
                        EndTime = sportEvent.EndTime,
                        ArrivalDate = sportEvent.ArrivalDate,
                        Location = sportEvent.Location,
                        Description = sportEvent.Description,
                        EventTypeId = sportEvent.EventTypeId,
                        TeamId = sportEvent.TeamId,
                        RivalId = sportEvent.Rival != null ? sportEvent.Rival.Id.Replace("\r", "").Replace("\n", "").Trim() : null
                    })
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
