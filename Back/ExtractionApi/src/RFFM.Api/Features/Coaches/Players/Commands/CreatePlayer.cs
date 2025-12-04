using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class CreatePlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/catalog/player",
                    async ([FromForm] CreatePlayerCommand request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(request, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(CreatePlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .DisableAntiforgery();
        }
    }

    public class CreatePlayerCommand : IRequest, IInvalidateCacheRequest
    {
        public string Name { get; set; } = null!;
        public string? LastName { get; set; } = null!;
        public string Alias { get; set; } = null!;
        public IFormFile? PhotoFile { get; set; }
        public DateTime? BirthDate { get; set; }
        public string? Dni { get; set; }
        public string ClubId { get; set; } = null!;
        public string PrefixCacheKey => PlayerConstants.CachePrefix;
    }

    public class CreatePlayerHandler : IRequestHandler<CreatePlayerCommand, Unit>
    {
        private readonly IPlayerService _playerService;
        public CreatePlayerHandler(IPlayerService playerService)
        {
            _playerService = playerService;
        }
        public async ValueTask<Unit> Handle(CreatePlayerCommand request, CancellationToken cancellationToken)
        {
            await _playerService.AddPlayerClub(new CreatePlayerModel
            {
                Name = request.Name,
                ClubId = request.ClubId,
                Alias = request.Alias,
                BirthDate = request.BirthDate,
                Dni = request.Dni,
                LastName = request.LastName,
                PhotoFile = request.PhotoFile
            }, cancellationToken);

            return Unit.Value;

        }
    }
    public class CreateValidator : AbstractValidator<CreatePlayerCommand>
    {
        public CreateValidator()
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

        }
    }

}
