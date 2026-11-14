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
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using static RFFM.Api.Features.Coaches.Players.Queries.GetTeamRatingConfig;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Create, edit, hide and restore the capacities (characteristics of the rating sheet) of a team.
    /// A default capacity is customized by sending its key together with its sheet and category, because the
    /// server does not own the default texts.
    /// POST/PUT /api/catalog/team/{teamId}/rating-config/capacities
    /// </summary>
    public class ManageTeamCapacities : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/catalog/team/{teamId}/rating-config/capacities",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, CreateCapacityRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new CreateCapacityCommand(teamId, req), ct)))
                .WithName(nameof(CreateCapacityCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<CapacityConfigResponse>();

            app.MapPut("/api/catalog/team/{teamId}/rating-config/capacities/{key}",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string key, UpdateCapacityRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new UpdateCapacityCommand(teamId, key, req), ct)))
                .WithName(nameof(UpdateCapacityCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<CapacityConfigResponse>();

            app.MapPut("/api/catalog/team/{teamId}/rating-config/capacities/{key}/visibility",
                    [Authorize(Roles = "Coach,Administrator")] async (string teamId, string key, SetCapacityVisibilityRequest req, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new SetCapacityVisibilityCommand(teamId, key, req), ct)))
                .WithName(nameof(SetCapacityVisibilityCommand))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces<CapacityConfigResponse>();
        }

        public record CreateCapacityRequest(string Sheet, string CategoryKey, string Label, IReadOnlyList<string> LevelTexts);

        public record UpdateCapacityRequest(string? Label, IReadOnlyList<string>? LevelTexts, string? Sheet, string? CategoryKey);

        public record SetCapacityVisibilityRequest(bool Hidden, string? Sheet, string? CategoryKey);

        public record CreateCapacityCommand(string TeamId, CreateCapacityRequest Request) : RFFM.Api.Common.ICommand<CapacityConfigResponse>;

        public record UpdateCapacityCommand(string TeamId, string Key, UpdateCapacityRequest Request) : RFFM.Api.Common.ICommand<CapacityConfigResponse>;

        public record SetCapacityVisibilityCommand(string TeamId, string Key, SetCapacityVisibilityRequest Request) : RFFM.Api.Common.ICommand<CapacityConfigResponse>;

        private static readonly Regex KeyPattern = new("^[A-Za-z0-9-]{1,50}$", RegexOptions.Compiled);

        private static bool IsValidKey(string? key) => key != null && KeyPattern.IsMatch(key);

        private static bool HasValidLevelTexts(IReadOnlyList<string>? texts) =>
            texts is { Count: RatingConfigRules.CapacityLevelCount }
            && texts.All(t => !string.IsNullOrWhiteSpace(t) && t.Length <= RatingConfigRules.MaxTextLength);

        private static bool HasValidSheetAndCategory(string? sheet, string? category) =>
            sheet is not null && category is not null
            && RatingConfigRules.Sheets.Contains(sheet) && RatingConfigRules.Categories.Contains(category);

        public class CreateCapacityValidator : AbstractValidator<CreateCapacityCommand>
        {
            public CreateCapacityValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Request.Label).NotEmpty().MaximumLength(RatingConfigRules.MaxLabelLength);
                RuleFor(x => x.Request).Must(r => HasValidSheetAndCategory(r.Sheet, r.CategoryKey))
                    .WithMessage("La hoja o la categoría indicada no existe.");
                RuleFor(x => x.Request.LevelTexts).Must(HasValidLevelTexts)
                    .WithMessage($"Hacen falta exactamente {RatingConfigRules.CapacityLevelCount} textos de nivel, cada uno de hasta {RatingConfigRules.MaxTextLength} caracteres.");
            }
        }

        public class UpdateCapacityValidator : AbstractValidator<UpdateCapacityCommand>
        {
            public UpdateCapacityValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Key).Must(IsValidKey).WithMessage("La clave indicada no es válida.");
                RuleFor(x => x.Request).Must(r => r.Label is not null || r.LevelTexts is not null)
                    .WithMessage("No hay nada que cambiar.");
                When(x => x.Request.Label is not null, () =>
                    RuleFor(x => x.Request.Label!).NotEmpty().MaximumLength(RatingConfigRules.MaxLabelLength));
                When(x => x.Request.LevelTexts is not null, () =>
                    RuleFor(x => x.Request.LevelTexts).Must(HasValidLevelTexts)
                        .WithMessage($"Hacen falta exactamente {RatingConfigRules.CapacityLevelCount} textos de nivel."));
                When(x => IsValidKey(x.Key) && !RatingConfigRules.IsCustomKey(x.Key), () =>
                    RuleFor(x => x.Request).Must(r => HasValidSheetAndCategory(r.Sheet, r.CategoryKey))
                        .WithMessage("Para una capacidad por defecto hacen falta su hoja y su categoría."));
            }
        }

        public class SetCapacityVisibilityValidator : AbstractValidator<SetCapacityVisibilityCommand>
        {
            public SetCapacityVisibilityValidator()
            {
                RuleFor(x => x.TeamId).NotEmpty();
                RuleFor(x => x.Key).Must(IsValidKey).WithMessage("La clave indicada no es válida.");
                When(x => IsValidKey(x.Key) && !RatingConfigRules.IsCustomKey(x.Key), () =>
                    RuleFor(x => x.Request).Must(r => HasValidSheetAndCategory(r.Sheet, r.CategoryKey))
                        .WithMessage("Para una capacidad por defecto hacen falta su hoja y su categoría."));
            }
        }

        /// <summary>The team's row for a key; a default key without row gets a new customization, an unknown custom key is not found.</summary>
        private static async Task<TeamCapacityDefinition> FindOrCreateAsync(
            AppDbContext db, string teamId, string key, string? sheet, string? category, CancellationToken ct)
        {
            var existing = await db.TeamCapacityDefinitions.FirstOrDefaultAsync(c => c.TeamId == teamId && c.Key == key, ct);
            if (existing is not null) return existing;

            if (RatingConfigRules.IsCustomKey(key) || sheet is null || category is null)
                throw new NotFoundException("Capacidad no encontrada", ManageTeamTraits.NotFoundCode);

            var created = TeamCapacityDefinition.ForDefault(teamId, key, sheet, category);
            db.TeamCapacityDefinitions.Add(created);
            return created;
        }

        public class CreateCapacityHandler : IRequestHandler<CreateCapacityCommand, CapacityConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public CreateCapacityHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<CapacityConfigResponse> Handle(CreateCapacityCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var r = request.Request;
                var capacity = TeamCapacityDefinition.CreateCustom(teamId, r.Sheet, r.CategoryKey, r.Label, r.LevelTexts);
                _db.TeamCapacityDefinitions.Add(capacity);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(capacity);
            }
        }

        public class UpdateCapacityHandler : IRequestHandler<UpdateCapacityCommand, CapacityConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public UpdateCapacityHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<CapacityConfigResponse> Handle(UpdateCapacityCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var r = request.Request;
                var capacity = await FindOrCreateAsync(_db, teamId, request.Key, r.Sheet, r.CategoryKey, cancellationToken);
                capacity.Update(r.Label, r.LevelTexts);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(capacity);
            }
        }

        public class SetCapacityVisibilityHandler : IRequestHandler<SetCapacityVisibilityCommand, CapacityConfigResponse>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public SetCapacityVisibilityHandler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<CapacityConfigResponse> Handle(SetCapacityVisibilityCommand request, CancellationToken cancellationToken = default)
            {
                var teamId = await TeamTraitRatingAccess.EnsureCanManageAsync(_db, _currentUser, request.TeamId, cancellationToken);
                var r = request.Request;
                var capacity = await FindOrCreateAsync(_db, teamId, request.Key, r.Sheet, r.CategoryKey, cancellationToken);
                capacity.SetHidden(r.Hidden);
                await _db.SaveChangesAsync(cancellationToken);
                return ToResponse(capacity);
            }
        }
    }
}
