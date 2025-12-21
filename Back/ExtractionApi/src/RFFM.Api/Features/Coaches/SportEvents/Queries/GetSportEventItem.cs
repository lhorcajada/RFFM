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
    public class GetSportEventItem : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/sport-events/item/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var query = new SportEventItemQuery { Id = id };
                        var result = await mediator.Send(query, cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetSportEventItem))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SportEventItemResponse>();
        }

        public record SportEventItemQuery : IQueryApp<SportEventItemResponse?>
        {
            public string Id { get; set; } = null!;
            public string CacheKey => $"SportEventItem_{Id}";
            public DateTime? AbsoluteExpirationRelativeToNow { get; }
        }

        public record SportEventItemResponse()
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

        public class GetSportEventItemRequestHandler : IRequestHandler<SportEventItemQuery, SportEventItemResponse?>
        {
            private readonly AppDbContext _db;

            public GetSportEventItemRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<SportEventItemResponse?> Handle(SportEventItemQuery request, CancellationToken cancellationToken = default)
            {
                var sportEvent = await _db.SportEvents.Include(s => s.Rival).FirstOrDefaultAsync(se => se.Id == request.Id, cancellationToken);
                if (sportEvent is null) return null;

                return new SportEventItemResponse
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
                };
            }
        }
    }
}
