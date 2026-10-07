using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Lottery
{
    public interface ILotteryCampaignFields
    {
        string Name { get; }
        DateOnly DrawDate { get; }
        decimal TicketPrice { get; }
        int TicketsPerBook { get; }
        DateOnly ClubDeliveryFrom { get; }
        DateOnly ClubDeliveryTo { get; }
    }

    public class LotteryCampaignFieldsValidator : AbstractValidator<ILotteryCampaignFields>
    {
        public LotteryCampaignFieldsValidator()
        {
            RuleFor(c => c.Name).NotEmpty().MaximumLength(LotteryCampaign.Rules.NameMaxLength);
            RuleFor(c => c.TicketPrice).GreaterThan(0);
            RuleFor(c => c.TicketsPerBook).InclusiveBetween(1, LotteryCampaign.Rules.MaxTicketsPerBook);
            RuleFor(c => c.ClubDeliveryTo).GreaterThanOrEqualTo(c => c.ClubDeliveryFrom)
                .WithMessage("La entrega al club no puede terminar antes de empezar.");
        }
    }

    /// <summary>
    /// Crea una campaña de lotería para el equipo.
    /// POST /api/teams/{teamId}/lottery-campaigns
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class CreateLotteryCampaign : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(LotteryConstants.BaseRoute,
                    async (string teamId, Command command, IMediator mediator, CancellationToken ct) =>
                    {
                        var campaign = await mediator.Send(command with { TeamId = teamId }, ct);
                        return Results.Created($"/api/teams/{teamId}/lottery-campaigns/{campaign.Id}", campaign);
                    })
                .WithName(nameof(CreateLotteryCampaign))
                .WithTags(LotteryConstants.Tag)
                .RequireAuthorization()
                .Produces<LotteryCampaignDto>(StatusCodes.Status201Created)
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Command : RFFM.Api.Common.ICommand<LotteryCampaignDto>, ILotteryCampaignFields, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; init; } = null!;
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
                Include(new LotteryCampaignFieldsValidator());
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = LotteryCampaign.Create(request.TeamId, request.Name, request.DrawDate, request.TicketPrice,
                    request.TicketsPerBook, request.ClubDeliveryFrom, request.ClubDeliveryTo);
                db.LotteryCampaigns.Add(campaign);
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
