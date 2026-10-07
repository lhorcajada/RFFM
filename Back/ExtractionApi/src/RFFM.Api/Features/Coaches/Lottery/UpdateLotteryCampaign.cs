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
    /// Cambia la configuración de la campaña. La ventana de entrega al club se puede mover siempre; el precio y
    /// las papeletas por taco, solo mientras no haya tacos.
    /// PUT /api/teams/{teamId}/lottery-campaigns/{campaignId}
    /// See openspec/changes/team-lottery/design.md → D1, D3.
    /// </summary>
    public class UpdateLotteryCampaign : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{LotteryConstants.BaseRoute}/{{campaignId}}",
                    async (string teamId, string campaignId, Command command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command with { TeamId = teamId, CampaignId = campaignId }, ct)))
                .WithName(nameof(UpdateLotteryCampaign))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command : RFFM.Api.Common.ICommand<LotteryCampaignDto>, ILotteryCampaignFields, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
            public string CampaignId { get; init; } = null!;
            public string Name { get; init; } = null!;
            public DateOnly DrawDate { get; init; }
            public decimal TicketPrice { get; init; }
            public int TicketsPerBook { get; init; }
            public DateOnly ClubDeliveryFrom { get; init; }
            public DateOnly ClubDeliveryTo { get; init; }
            public string FeatureRoute => CoachFeatureRoutes.Lottery;
            public string RequiredPermission => LotteryConstants.ReadWrite;
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.CampaignId).NotEmpty();
                Include(new LotteryCampaignFieldsValidator());
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.Update(request.Name, request.DrawDate, request.TicketPrice, request.TicketsPerBook,
                    request.ClubDeliveryFrom, request.ClubDeliveryTo);
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
