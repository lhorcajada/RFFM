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
    /// Corrige el número de taco, la primera o la última papeleta mientras el taco no esté entregado al jugador.
    /// PUT /api/teams/{teamId}/lottery-campaigns/{campaignId}/books/{bookId}
    /// See openspec/changes/team-lottery/design.md → D3.
    /// </summary>
    public class UpdateLotteryBook : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{LotteryConstants.BaseRoute}/{{campaignId}}/books/{{bookId}}",
                    async (string teamId, string campaignId, string bookId, Command command, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(command with { TeamId = teamId, CampaignId = campaignId, BookId = bookId }, ct)))
                .WithName(nameof(UpdateLotteryBook))
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
            public int BookNumber { get; init; }
            public int FirstTicketNumber { get; init; }
            public int LastTicketNumber { get; init; }
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
                RuleFor(c => c.BookNumber).GreaterThan(0);
                RuleFor(c => c.FirstTicketNumber).GreaterThanOrEqualTo(0);
                RuleFor(c => c.LastTicketNumber).GreaterThanOrEqualTo(c => c.FirstTicketNumber);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                campaign.EditBook(request.BookId, request.BookNumber, request.FirstTicketNumber, request.LastTicketNumber);
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
