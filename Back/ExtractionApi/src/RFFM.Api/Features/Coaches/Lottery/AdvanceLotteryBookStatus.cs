using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    /// <summary>
    /// Avanza un taco un paso con los datos de ese paso: fecha de entrega al jugador, fecha e importe de la devolución
    /// al entrenador, o fecha de entrega al club. Sin fecha, hoy.
    /// PUT /api/teams/{teamId}/lottery-campaigns/{campaignId}/books/{bookId}/status
    /// </summary>
    public class AdvanceLotteryBookStatus : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{LotteryConstants.BaseRoute}/{{campaignId}}/books/{{bookId}}/status",
                    async (string teamId, string campaignId, string bookId, Command command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command with { TeamId = teamId, CampaignId = campaignId, BookId = bookId }, ct)))
                .WithName(nameof(AdvanceLotteryBookStatus))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand<LotteryCampaignDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string CampaignId { get; init; } = null!;
            public string BookId { get; init; } = null!;
            public DateOnly? Date { get; init; }
            public decimal? Amount { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.ReadWrite;
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.CampaignId).NotEmpty();
                RuleFor(c => c.BookId).NotEmpty();
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.AdvanceBook(request.BookId, request.Date ?? LotteryCampaignMapping.Today(), request.Amount);
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
