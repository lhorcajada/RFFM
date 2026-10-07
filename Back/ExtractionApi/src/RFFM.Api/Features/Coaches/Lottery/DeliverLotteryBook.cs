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
    /// Entrega un taco a un jugador del equipo. Sin fecha, se entrega hoy.
    /// POST /api/teams/{teamId}/lottery-campaigns/{campaignId}/books
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class DeliverLotteryBook : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{LotteryConstants.BaseRoute}/{{campaignId}}/books",
                    async (string teamId, string campaignId, Command command, IMediator mediator, CancellationToken ct) =>
                    {
                        var campaign = await mediator.Send(command with { TeamId = teamId, CampaignId = campaignId }, ct);
                        return Results.Created($"/api/teams/{teamId}/lottery-campaigns/{campaignId}", campaign);
                    })
                .WithName(nameof(DeliverLotteryBook))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand<LotteryCampaignDto>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string CampaignId { get; init; } = null!;
            public string TeamPlayerId { get; init; } = null!;
            public int BookNumber { get; init; }
            public int FirstTicketNumber { get; init; }
            public DateOnly? DeliveredOn { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.ReadWrite;
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.CampaignId).NotEmpty();
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.BookNumber).GreaterThan(0);
                RuleFor(c => c.FirstTicketNumber).GreaterThanOrEqualTo(0);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await LotteryCampaignMapping.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.DeliverBook(request.TeamPlayerId, request.BookNumber, request.FirstTicketNumber,
                    request.DeliveredOn ?? LotteryCampaignMapping.Today());
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
