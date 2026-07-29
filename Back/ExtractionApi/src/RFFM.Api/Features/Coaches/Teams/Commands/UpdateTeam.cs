using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Teams.Commands
{
    public class UpdateTeam : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/catalog/team/{id}",
                    async (string id, UpdateTeamCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        command.TeamModel.Id = id;
                        command.UserId = httpContext.User.Claims.FirstOrDefault(c =>
                            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdateTeam))
                .WithTags(TeamConstants.TeamFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class UpdateTeamCommand : IRequest, IInvalidateCacheRequest, IRequireFeaturePermission
    {
        public TeamModel TeamModel { get; set; }
        public string? UserId { get; set; }

        public string PrefixCacheKey => TeamConstants.CachePrefix;
        public string FeatureRoute => CoachFeatureRoutes.ClubTeams;
        public string RequiredPermission => "ReadWrite";
    }

    public class UpdateTeamHandler : IRequestHandler<UpdateTeamCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public UpdateTeamHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(UpdateTeamCommand request, CancellationToken cancellationToken)
        {
            var team = await _catalogDbContext.Teams
                .FirstOrDefaultAsync(c => c.Id == request.TeamModel.Id, cancellationToken: cancellationToken);
            if (team == null)
                throw new KeyNotFoundException($"Team '{request.TeamModel.Id}' Not Found");

            var canEdit = await TeamEditAuthorization.CanEditAsync(
                _catalogDbContext, request.UserId, team.Id, team.ClubId, cancellationToken);
            if (!canEdit)
                throw new ForbiddenAccessException("No tienes permiso para editar este equipo.");

            team.UpdateName(request.TeamModel.Name);
            team.UpdateUrlPhoto(request.TeamModel.UrlPhoto);
            team.UpdateCategoryId(request.TeamModel.CategoryId);
            team.UpdateClubId(request.TeamModel.ClubId);
            team.UpdateLeagueId(request.TeamModel.LeagueId);
            team.UpdateLeagueGroup(request.TeamModel.LeagueGroup);

            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class UpdateValidator : AbstractValidator<UpdateTeamCommand>
    {
        public UpdateValidator()
        {
            RuleFor(r => r.TeamModel.Name)
                .NotEmpty()
                .MaximumLength(ValidationConstants.TeamNameMaxLength);

            RuleFor(r => r.TeamModel.UrlPhoto)
                .MaximumLength(ValidationConstants.TeamUrlPhotoMaxLength);
            RuleFor(r => r.TeamModel.CategoryId)
                .GreaterThan(0)
                .WithMessage(ValidationConstants.TeamCategoryIdMustBeGreaterThanZero);
        }
    }

}
