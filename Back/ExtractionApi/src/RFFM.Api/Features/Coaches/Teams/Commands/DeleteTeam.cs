using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class DeleteTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/catalog/team/{id}",
                    async (string id, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        try
                        {
                            var request = new DeleteTeamCommand
                            {
                                TeamId = id
                            };
                            await mediator.Send(request, cancellationToken);
                            return Results.Ok();
                        }
                        catch (DomainException exception) when (exception.Code == ErrorCodes.TeamHasPlayers)
                        {
                            return Results.Conflict(new ProblemDetails
                            {
                                Title = exception.Title,
                                Detail = exception.Description,
                                Extensions = { ["code"] = exception.Code }
                            });
                        }
                    })
                .WithName(nameof(DeleteTeam))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class DeleteTeamCommand : IRequest, IInvalidateCacheRequest
    {
        public string TeamId { get; set; } = string.Empty;
        public string PrefixCacheKey => TeamConstants.CachePrefix;
    }

    public class DeleteTeamHandler : IRequestHandler<DeleteTeamCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public DeleteTeamHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }

        public async ValueTask<Unit> Handle(DeleteTeamCommand request, CancellationToken cancellationToken)
        {
            var team = await _catalogDbContext.Teams
                .FirstOrDefaultAsync(c => c.Id == request.TeamId, cancellationToken);
            if (team == null)
                throw new KeyNotFoundException($"Team '{request.TeamId}' Not Found");

            var hasPlayers = await _catalogDbContext.TeamPlayers
                .AnyAsync(tp => tp.TeamId == team.Id, cancellationToken);

            if (hasPlayers)
            {
                throw new DomainException(
                    "Equipos",
                    "No se puede eliminar el equipo porque tiene jugadores asociados.",
                    ErrorCodes.TeamHasPlayers);
            }

            _catalogDbContext.Teams.Remove(team);
            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    public class DeleteTeamValidator : AbstractValidator<DeleteTeamCommand>
    {
        public DeleteTeamValidator()
        {
            RuleFor(r => r.TeamId)
                .NotEmpty();
        }
    }
}
