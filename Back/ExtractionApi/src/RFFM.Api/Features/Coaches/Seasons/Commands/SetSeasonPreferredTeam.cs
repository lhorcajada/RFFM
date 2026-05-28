using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.Aggregates.UserClubs;

namespace RFFM.Api.Features.Coaches.Seasons.Commands
{
    public class SetSeasonPreferredTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/season/{seasonId}/preferred-team",
                    async (string seasonId, SetSeasonPreferredTeamCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        command.SeasonId = seasonId;
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(SetSeasonPreferredTeam))
                .WithTags(SeasonConstants.SeasonFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest);
        }
    }

    public class SetSeasonPreferredTeamCommand : IRequest
    {
        public string SeasonId { get; set; } = null!;
        public string? TeamId { get; set; }
    }

    public class SetSeasonPreferredTeamHandler : IRequestHandler<SetSeasonPreferredTeamCommand, Unit>
    {
        private readonly AppDbContext _db;

        public SetSeasonPreferredTeamHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<Unit> Handle(SetSeasonPreferredTeamCommand request, CancellationToken cancellationToken)
        {
            var season = await _db.Seasons.FirstOrDefaultAsync(s => s.Id == request.SeasonId, cancellationToken);
            if (season == null)
                throw new KeyNotFoundException($"Season '{request.SeasonId}' Not Found");

            if (!string.IsNullOrWhiteSpace(request.TeamId))
            {
                var team = await _db.Teams.FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);
                if (team == null)
                    throw new DomainException("Preferred team", $"Team '{request.TeamId}' not found", "");
                if (team.SeasonId != season.Id)
                    throw new DomainException("Preferred team", $"Team '{request.TeamId}' doesn't belong to season '{season.Id}'", "");
            }

            season.UpdatePreferredTeam(request.TeamId);

            if (season.IsActive)
            {
                var coaches = await _db.ConfigurationCoaches.ToListAsync(cancellationToken);
                foreach (var cfg in coaches)
                {
                    cfg.PreferredTeamId = request.TeamId;
                }
            }

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }
}
