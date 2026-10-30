using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// El entrenador recarga el monedero de un usuario del equipo (importe &gt; 0, máximo 10,00 €).
    /// POST /api/teams/{teamId}/quiniela/wallets/{userId}/top-ups
    /// See openspec/changes/quiniela-wallet/design.md → D1, D6.
    /// </summary>
    public class TopUpQuinielaWallet : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{QuinielaConstants.BaseRoute}/wallets/{{userId}}/top-ups",
                    async (string teamId, string userId, Body body, IMediator mediator, CancellationToken ct) =>
                    {
                        var result = await mediator.Send(new Command(teamId, userId, body.Amount, body.Description), ct);
                        return Results.Created($"/api/teams/{teamId}/quiniela/wallets/{userId}", result);
                    })
                .WithName(nameof(TopUpQuinielaWallet))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaWalletOperationDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Body(decimal Amount, string? Description);

        public record Command(string TeamId, string UserId, decimal Amount, string? Description) : RFFM.Api.Common.ICommand<QuinielaWalletOperationDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.UserId).NotEmpty();
                RuleFor(c => c.Amount).GreaterThan(0m).LessThanOrEqualTo(QuinielaWallet.Rules.MaxMovementAmount)
                    .Must(amount => decimal.Round(amount, 2) == amount).WithMessage("El importe admite como máximo dos decimales.");
                RuleFor(c => c.Description).MaximumLength(QuinielaWallet.Rules.MaxDescriptionLength);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaWalletOperationDto>
        {
            public async ValueTask<QuinielaWalletOperationDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);
                await QuinielaSupport.EnsureWalletOwnerInTeamAsync(db, request.TeamId, request.UserId, cancellationToken);

                return await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var wallet = await db.QuinielaWallets.SingleOrDefaultAsync(
                        w => w.TeamId == request.TeamId && w.ApplicationUserId == request.UserId, cancellationToken);
                    if (wallet is null)
                    {
                        wallet = QuinielaWallet.Create(request.TeamId, request.UserId);
                        db.QuinielaWallets.Add(wallet);
                    }

                    var now = timeProvider.GetUtcNow().UtcDateTime;
                    var movement = wallet.TopUp(request.Amount, currentUser.UserId!, request.Description, now);
                    db.QuinielaWalletMovements.Add(movement);
                    await db.SaveChangesAsync(cancellationToken);
                    return new QuinielaWalletOperationDto(request.UserId, wallet.Balance, QuinielaSupport.ToDto(movement));
                });
            }
        }
    }
}
