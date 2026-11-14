using System.Text.RegularExpressions;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.PositionFit;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamRatingConfig;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Create, edit, hide and restore the behavior traits of a team.
    /// POST/PUT /api/catalog/team/{teamId}/rating-config/traits
    /// </summary>
    public class ManageTeamTraits : IFeatureModule
    {
        public const string NotFoundCode = "RatingConfigElementNotFound";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/rating-config/traits",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, CreateTraitRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new CreateTraitCommand(teamId, req), ct)))
                .WithName(nameof(CreateTraitCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<TraitConfigResponse>();

            app.MapPut("/api/catalog/team/{teamId}/rating-config/traits/{key}",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string key, UpdateTraitRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new UpdateTraitCommand(teamId, key, req), ct)))
                .WithName(nameof(UpdateTraitCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<TraitConfigResponse>();

            app.MapPut("/api/catalog/team/{teamId}/rating-config/traits/{key}/visibility",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string key, SetTraitVisibilityRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new SetTraitVisibilityCommand(teamId, key, req), ct)))
                .WithName(nameof(SetTraitVisibilityCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<TraitConfigResponse>();
        }

        public record CreateTraitRequest(string Label, string Phase, string Anchor1, string Anchor3, string Anchor5);

        public record UpdateTraitRequest(string? Label, string? Phase, string? Anchor1, string? Anchor3, string? Anchor5);

        public record SetTraitVisibilityRequest(bool Hidden);

        public record CreateTraitCommand(string TeamId, CreateTraitRequest Request) : RFFM.Api.Common.ICommand<TraitConfigResponse>;

        public record UpdateTraitCommand(string TeamId, string Key, UpdateTraitRequest Request) : RFFM.Api.Common.ICommand<TraitConfigResponse>;

        public record SetTraitVisibilityCommand(string TeamId, string Key, SetTraitVisibilityRequest Request) : RFFM.Api.Common.ICommand<TraitConfigResponse>;

        private static readonly Regex KeyPattern = new("^[A-Za-z0-9-]{1,50}$", RegexOptions.Compiled);

        private static IRuleBuilderOptions<T, string> Text<T>(IRuleBuilder<T, string> rule, int maxLength) =>
            rule.NotEmpty().MaximumLength(maxLength);

        public class CreateTraitValidator : AbstractValidator<CreateTraitCommand>
        {
            public CreateTraitValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                Text(RuleFor(x => x.Request.Label), RatingConfigRules.MaxLabelLength);
                RuleFor(x => x.Request.Phase).Must(phase => TraitPhaseKeys.TryParse(phase).HasValue)
                    .WithMessage("La fase indicada no existe.");
                Text(RuleFor(x => x.Request.Anchor1), RatingConfigRules.MaxTextLength);
                Text(RuleFor(x => x.Request.Anchor3), RatingConfigRules.MaxTextLength);
                Text(RuleFor(x => x.Request.Anchor5), RatingConfigRules.MaxTextLength);
            }
        }

        public class UpdateTraitValidator : AbstractValidator<UpdateTraitCommand>
        {
            public UpdateTraitValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Key).Must(key => key != null && KeyPattern.IsMatch(key))
                    .WithMessage("La clave indicada no es válida.");
                RuleFor(x => x.Request)
                    .Must(r => r.Label is not null || r.Phase is not null || r.Anchor1 is not null || r.Anchor3 is not null || r.Anchor5 is not null)
                    .WithMessage("No hay nada que cambiar.");
                When(x => x.Request.Label is not null, () => Text(RuleFor(x => x.Request.Label!), RatingConfigRules.MaxLabelLength));
                When(x => x.Request.Phase is not null, () =>
                    RuleFor(x => x.Request.Phase!).Must(phase => TraitPhaseKeys.TryParse(phase).HasValue)
                        .WithMessage("La fase indicada no existe."));
                When(x => x.Request.Anchor1 is not null, () => Text(RuleFor(x => x.Request.Anchor1!), RatingConfigRules.MaxTextLength));
                When(x => x.Request.Anchor3 is not null, () => Text(RuleFor(x => x.Request.Anchor3!), RatingConfigRules.MaxTextLength));
                When(x => x.Request.Anchor5 is not null, () => Text(RuleFor(x => x.Request.Anchor5!), RatingConfigRules.MaxTextLength));
            }
        }

        public class SetTraitVisibilityValidator : AbstractValidator<SetTraitVisibilityCommand>
        {
            public SetTraitVisibilityValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Key).Must(key => key != null && KeyPattern.IsMatch(key))
                    .WithMessage("La clave indicada no es válida.");
            }
        }

        /// <summary>The team's row for a key; a default key without row gets a new customization, an unknown key is not found.</summary>
        private static async Task<TeamTraitDefinition> FindOrCreateAsync(AppDbContext db, string teamId, string key, CancellationToken ct)
        {
            var existing = await db.TeamTraitDefinitions.FirstOrDefaultAsync(t => t.TeamId == teamId && t.Key == key, ct);
            if (existing is not null) return existing;

            var isUnknown = RatingConfigRules.IsCustomKey(key) || !TraitCatalog.IsKnown(key);
            if (isUnknown)
                throw new NotFoundException("Rasgo no encontrado", NotFoundCode);

            var created = TeamTraitDefinition.ForDefault(teamId, key);
            db.TeamTraitDefinitions.Add(created);
            return created;
        }

        public class CreateTraitHandler : IRequestHandler<CreateTraitCommand, TraitConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public CreateTraitHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<TraitConfigResponse> Handle(CreateTraitCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var r = request.Request;
                var trait = TeamTraitDefinition.CreateCustom(teamId, r.Label, r.Phase, r.Anchor1, r.Anchor3, r.Anchor5);
                _db.TeamTraitDefinitions.Add(trait);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(trait);
            }
        }

        public class UpdateTraitHandler : IRequestHandler<UpdateTraitCommand, TraitConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public UpdateTraitHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<TraitConfigResponse> Handle(UpdateTraitCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var trait = await FindOrCreateAsync(_db, teamId, request.Key, cancellationToken);
                var r = request.Request;
                trait.Update(r.Label, r.Phase, r.Anchor1, r.Anchor3, r.Anchor5);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(trait);
            }
        }

        public class SetTraitVisibilityHandler : IRequestHandler<SetTraitVisibilityCommand, TraitConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public SetTraitVisibilityHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<TraitConfigResponse> Handle(SetTraitVisibilityCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var trait = await FindOrCreateAsync(_db, teamId, request.Key, cancellationToken);
                trait.SetHidden(request.Request.Hidden);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(trait);
            }
        }
    }
}
