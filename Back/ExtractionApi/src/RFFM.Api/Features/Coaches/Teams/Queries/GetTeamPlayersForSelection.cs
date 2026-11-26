using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Queries
{
    public class GetTeamPlayersForSelection : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/team/{teamId}/players-for-selection",
                    async (string teamId, string? joinCode, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamPlayersQuery(teamId, joinCode), cancellationToken);
                        return result is null
                            ? Results.NotFound()
                            : Results.Ok(result);
                    })
                .WithName(nameof(GetTeamPlayersForSelection))
                .WithTags(TeamConstants.TeamFeature)
                .Produces<GetTeamPlayersResponse>()
                .Produces(StatusCodes.Status404NotFound)
                .RequireAuthorization();
        }

        public record PlayerForSelection(
            string Id,
            string Name,
            string? LastName,
            string? Alias,
            string? UrlPhoto,
            string? BirthDate,
            int? Dorsal);

        public record GetTeamPlayersQuery(string TeamId, string? JoinCode = null) : IRequest<GetTeamPlayersResponse?>;

        public record GetTeamPlayersResponse(
            string TeamId,
            string TeamName,
            List<PlayerForSelection> Players);

        public class Handler : IRequestHandler<GetTeamPlayersQuery, GetTeamPlayersResponse?>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<GetTeamPlayersResponse?> Handle(
                GetTeamPlayersQuery request,
                CancellationToken cancellationToken = default)
            {
                // A valid join code for this exact team lets a caller who is not yet linked list its players (onboarding).
                var provesTeam = await TeamJoinCodeGate.ProvesTeamAsync(_db, request.TeamId, request.JoinCode, cancellationToken);

                var teams = provesTeam ? _db.Teams.IgnoreQueryFilters() : _db.Teams;
                var team = await teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team is null) return null;

                var teamPlayers = provesTeam ? _db.TeamPlayers.IgnoreQueryFilters() : _db.TeamPlayers;
                var players = await teamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Where(tp => tp.TeamId == request.TeamId)
                    .OrderBy(tp => tp.Player.Name)
                    .ThenBy(tp => tp.Player.LastName)
                    .Select(tp => new PlayerForSelection(
                        tp.Id,
                        tp.Player.Name,
                        tp.Player.LastName,
                        tp.Player.Alias,
                        tp.Player.UrlPhoto,
                        tp.Player.BirthDate.HasValue ? tp.Player.BirthDate.Value.ToString("yyyy-MM-dd") : null,
                        tp.Dorsal != null ? tp.Dorsal.Number : null))
                    .ToListAsync(cancellationToken);

                return new GetTeamPlayersResponse(team.Id, team.Name, players);
            }
        }
    }
}
