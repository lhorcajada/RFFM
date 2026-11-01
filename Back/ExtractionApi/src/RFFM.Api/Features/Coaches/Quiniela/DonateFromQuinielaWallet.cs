using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Un participante (entrenador incluido) dona al fondo del equipo parte del saldo de su propio monedero.
    /// Sin tope de importe: solo lo limita el saldo. No se puede deshacer.
    /// POST /api/teams/{teamId}/quiniela/wallet/donations
    /// </summary>
    public class DonateFromQuinielaWallet : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{QuinielaConstants.BaseRoute}/wallet/donations",
                    async (string teamId, Body body, IMediator mediator, CancellationToken ct) =>
                        Results.Created($"/api/teams/{teamId}/quiniela/wallet", await mediator.Send(new Command(teamId, body.Amount), ct)))
                .WithName(nameof(DonateFromQuinielaWallet))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaWalletOperationDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Body(decimal Amount);

        public record Command(string TeamId, decimal Amount) : RFFM.Api.Common.ICommand<QuinielaWalletOperationDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.Amount).GreaterThan(0m)
                    .Must(amount => decimal.Round(amount, 2) == amount).WithMessage("El importe admite como máximo dos decimales.");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser, TimeProvider timeProvider, IdentityDbContext? identityDb = null)
            : IRequestHandler<Command, QuinielaWalletOperationDto>
        {
            public async ValueTask<QuinielaWalletOperationDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);
                var userId = currentUser.UserId!;
                var participants = await QuinielaSupport.LoadParticipantsAsync(db, request.TeamId, [userId], cancellationToken, identityDb);

                return await QuinielaSupport.RunWithWalletRetryAsync(db, async () =>
                {
                    var wallet = await db.QuinielaWallets.SingleOrDefaultAsync(
                            w => w.TeamId == request.TeamId && w.ApplicationUserId == userId, cancellationToken)
                        ?? throw new ConflictException("No tienes saldo en el monedero.", ErrorCodes.QuinielaWalletInsufficientBalance);

                    var now = timeProvider.GetUtcNow().UtcDateTime;
                    var movement = wallet.Donate(request.Amount, now, "Donación al equipo");
                    db.QuinielaWalletMovements.Add(movement);
                    db.TeamFundMovements.Add(TeamFundMovement.Create(
                        request.TeamId, request.Amount, TeamFundMovementSource.QuinielaDonation, null, now,
                        $"Donación de {participants[userId].Name}"));
                    await db.SaveChangesAsync(cancellationToken);
                    return new QuinielaWalletOperationDto(userId, wallet.Balance, QuinielaSupport.ToDto(movement));
                });
            }
        }
    }
}
