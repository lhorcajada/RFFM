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
    /// Asigna un taco a un jugador del equipo. Con <c>BookId</c> asigna un taco sin asignar ya creado; sin él, crea el
    /// taco ya asignado. Guarda número de taco, primera y última papeleta.
    /// POST /api/teams/{teamId}/lottery-campaigns/{campaignId}/books
    /// </summary>
    public class AssignLotteryBook : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost($"{LotteryConstants.BaseRoute}/{{campaignId}}/books",
                    async (string teamId, string campaignId, Command command, IMediator mediator, CancellationToken ct) =>
                    {
                        var campaign = await mediator.Send(command with { TeamId = teamId, CampaignId = campaignId }, ct);
                        return Results.Created($"/api/teams/{teamId}/lottery-campaigns/{campaignId}", campaign);
                    })
                .WithName(nameof(AssignLotteryBook))
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
            public string? BookId { get; init; }
            public string TeamPlayerId { get; init; } = null!;
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
                RuleFor(c => c.TeamPlayerId).NotEmpty();
                RuleFor(c => c.BookNumber).GreaterThan(0);
                RuleFor(c => c.FirstTicketNumber).GreaterThanOrEqualTo(0);
                RuleFor(c => c.LastTicketNumber).GreaterThanOrEqualTo(c => c.FirstTicketNumber);
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, LotteryCampaignDto>
        {
            public async ValueTask<LotteryCampaignDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await LotteryCampaignMapping.EnsurePlayerInTeamAsync(db, request.TeamId, request.TeamPlayerId, cancellationToken);
                var campaign = await LotteryCampaignMapping.LoadAsync(db, request.TeamId, request.CampaignId, cancellationToken);
                var book = campaign.AssignBook(request.BookId, request.TeamPlayerId, request.BookNumber,
                    request.FirstTicketNumber, request.LastTicketNumber);
                if (request.BookId is null)
                    db.LotteryBooks.Add(book);
                await db.SaveChangesAsync(cancellationToken);
                return await LotteryCampaignMapping.ToDtoAsync(db, currentUser, campaign, cancellationToken);
            }
        }
    }
}
