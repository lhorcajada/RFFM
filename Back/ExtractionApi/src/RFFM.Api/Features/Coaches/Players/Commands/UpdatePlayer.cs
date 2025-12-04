using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class UpdatePlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("api/catalog/player",
                    async (UpdatePlayerCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(UpdatePlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class UpdatePlayerCommand : IRequest, IInvalidateCacheRequest
    {
        public string Id { get; set; } = null!;
        public string Name { get; set; } = null!;
        public string? LastName { get; set; } = null!;
        public string Alias { get; set; } = null!;
        public string? UrlPhoto { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Dni { get; set; }
        public string ClubId { get; set; } = null!;
        public string PrefixCacheKey => PlayerConstants.CachePrefix;
    }

    public class UpdateDeletePlayerHandler : IRequestHandler<UpdatePlayerCommand, Unit>
    {
        private readonly AppDbContext _catalogDbContext;

        public UpdateDeletePlayerHandler(AppDbContext catalogDbContext)
        {
            _catalogDbContext = catalogDbContext;
        }
        public async ValueTask<Unit> Handle(UpdatePlayerCommand request, CancellationToken cancellationToken)
        {
            var player = await _catalogDbContext.Players
                .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken: cancellationToken);
            if (player == null)
                throw new KeyNotFoundException($"Player '{request.Id}' Not Found");

            player.UpdateName(request.Name);
            player.UpdateLastName(request.LastName);
            player.UpdateBirthDate(request.BirthDate);
            player.UpdateDni(request.Dni);
            player.UpdateUrlPhoto(request.UrlPhoto);
            player.UpdateAlias(request.Alias);

            await _catalogDbContext.SaveChangesAsync(cancellationToken);
            return Unit.Value;

        }
    }
    public class UpdatePlayerValidator : AbstractValidator<UpdatePlayerCommand>
    {
        public UpdatePlayerValidator()
        {
            RuleFor(r => r.Name)
                .NotEmpty()
                .MaximumLength(ValidationConstants.PlayerNameMaxLength);

            RuleFor(r => r.Alias)
                .NotEmpty()
                .MaximumLength(ValidationConstants.PlayerAliasMaxLength);

            RuleFor(r => r.BirthDate)
                .Must(birthDate => birthDate == null || birthDate < DateTime.Now)
                .WithMessage(ValidationConstants.PlayerBirthDateCannotBeBeforeMinValue);

            RuleFor(r => r.Dni)
                .MaximumLength(ValidationConstants.PlayerDniMaxLength);
            RuleFor(r => r.LastName)
                .MaximumLength(ValidationConstants.PlayerLastNameMaxLength);

            RuleFor(r => r.UrlPhoto)
                .MaximumLength(ValidationConstants.PlayerUrlPhotoMaxLength);

        }
    }
}
