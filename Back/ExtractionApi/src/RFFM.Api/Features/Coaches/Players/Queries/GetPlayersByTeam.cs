using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Entities.Demarcations;

namespace RFFM.Api.Features.Coaches.Players.Queries
{
    public class GetPlayersByTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/players",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        return await mediator.Send(new PlayersByTeamQuery() { TeamId = teamId }, cancellationToken);
                    })
                .WithName(nameof(GetPlayersByTeam))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<PlayersByTeamResponse[]>();
        }

        public record PlayersByTeamQuery : IQueryApp<PlayersByTeamResponse[]>
        {
            public string TeamId { get; set; } = null!;
        }

        public record PlayersByTeamResponse()
        {
            public string Id { get; set; } = null!;
            public string Name { get; set; } = null!;
            public string? LastName { get; set; } = null!;
            public string Alias { get; set; } = null!;
            public string? UrlPhoto { get; set; }
            public int? Dorsal { get; set; }
            public string? Position { get; set; }

        };

        public class GetPlayersByTeamRequestHandler : IRequestHandler<PlayersByTeamQuery, PlayersByTeamResponse[]>
        {
            private readonly AppDbContext _db;

            public GetPlayersByTeamRequestHandler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<PlayersByTeamResponse[]> Handle(PlayersByTeamQuery request, CancellationToken cancellationToken = default)
            {
                // fetch data including ActivePositionId, then map to demarcation name using in-memory lookup
                var items = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .Select(tp => new
                    {
                        tp.Id,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Player.Alias,
                        tp.Player.UrlPhoto,
                        Dorsal = tp.Dorsal != null ? tp.Dorsal.Number : (int?)null,
                        ActivePositionId = tp.Demarcation != null ? (int?)tp.Demarcation.ActivePositionId : null
                    })
                    .ToArrayAsync(cancellationToken);

                return items.Select(i => new PlayersByTeamResponse
                {
                    Id = i.Id,
                    Name = i.Name,
                    LastName = i.LastName,
                    Alias = i.Alias,
                    UrlPhoto = i.UrlPhoto,
                    Dorsal = i.Dorsal,
                    Position = i.ActivePositionId != null ? DemarcationMaster.GetById(i.ActivePositionId.Value)?.Name : null
                }).ToArray();
            }
        }
    }
}
