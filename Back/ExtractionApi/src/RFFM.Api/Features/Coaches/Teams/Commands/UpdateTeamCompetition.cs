using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    /// <summary>
    /// Associates (or clears) an existing team's RFFM competition/group — the ids RFFM itself
    /// uses for its own scraped catalog (see GetCompetitions.cs/GetGroups.cs), distinct from
    /// the pre-existing local Liga/Grupo catalog (Team.LeagueId/LeagueGroup), which is untouched
    /// by this command.
    /// </summary>
    public class UpdateTeamCompetition : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/catalog/team/{id}/competition",
                    async (string id, UpdateTeamCompetitionCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        command.Id = id;
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateTeamCompetition))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class UpdateTeamCompetitionCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public string Id { get; set; } = null!;
        public int? RffmCompetitionId { get; set; }
        public int? RffmGroupId { get; set; }

        public string PrefixCacheKey => TeamConstants.CachePrefix;
        public string FeatureRoute => CoachFeatureRoutes.ClubTeams;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateTeamCompetitionHandler : IRequestHandler<UpdateTeamCompetitionCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public UpdateTeamCompetitionHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }

        public async ValueTask<Unit> Handle(UpdateTeamCompetitionCommand request, CancellationToken cancellationToken)
        {
            var team = await _catalogDbContext.Teams
                .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);
            if (team == null)
                throw new KeyNotFoundException($"Team '{request.Id}' Not Found");

            team.UpdateRffmCompetitionId(request.RffmCompetitionId);
            team.UpdateRffmGroupId(request.RffmGroupId);

            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }
    }

    public class UpdateTeamCompetitionValidator : AbstractValidator<UpdateTeamCompetitionCommand>
    {
        public UpdateTeamCompetitionValidator()
        {
            RuleFor(r => r.RffmCompetitionId)
                .GreaterThan(0)
                .When(r => r.RffmCompetitionId.HasValue);

            RuleFor(r => r.RffmGroupId)
                .GreaterThan(0)
                .When(r => r.RffmGroupId.HasValue);
        }
    }
}
