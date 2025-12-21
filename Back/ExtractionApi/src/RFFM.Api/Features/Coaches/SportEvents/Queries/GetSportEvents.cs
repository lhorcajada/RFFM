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
                    async (string teamId, int pageNumber, int pageSize, DateTime? startDate, DateTime? endDate, bool descending, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new SportEventsQuery
                        {
                            TeamId = teamId,
                            PageNumber = pageNumber,
                            PageSize = pageSize,
                            StartDate = startDate,
                            EndDate = endDate,
                            Descending = descending
                        };
                        var result = await mediator.Send(query, cancellationToken);
                        return Results.Ok(result);
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
            public DateTime? StartDate { get; set; }
            public DateTime? EndDate { get; set; }
            public bool Descending { get; set; } = false;
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
            private readonly IHttpContextAccessor _httpContextAccessor;

            public GetSportEventsRequestHandler(AppDbContext db, IHttpContextAccessor httpContextAccessor)
            {
                _db = db;
                _httpContextAccessor = httpContextAccessor;
            }

            public async ValueTask<SportEventResponse[]> Handle(SportEventsQuery request, CancellationToken cancellationToken = default)
            {
                var query = _db.SportEvents.Include(s => s.Rival).Where(e => e.TeamId == request.TeamId).AsQueryable();

                if (request.StartDate.HasValue)
                {
                    query = query.Where(e => e.EveDateTime >= request.StartDate.Value);
                }
                if (request.EndDate.HasValue)
                {
                    query = query.Where(e => e.EveDateTime <= request.EndDate.Value);
                }

                var total = await query.CountAsync(cancellationToken);
                try
                {
                    _httpContextAccessor.HttpContext.Response.Headers["X-Total-Count"] = total.ToString();
                }
                catch
                {
                    // ignore if no http context available
                }

                var ordered = request.Descending ? query.OrderByDescending(s => s.EveDateTime) : query.OrderBy(s => s.EveDateTime);

                var items = await ordered
                    .Skip((request.PageNumber - 1) * request.PageSize)
                    .Take(request.PageSize)
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

                return items;
            }
        }

        // Note: request handling is implemented directly in the AddRoutes lambda above.
    }
}
