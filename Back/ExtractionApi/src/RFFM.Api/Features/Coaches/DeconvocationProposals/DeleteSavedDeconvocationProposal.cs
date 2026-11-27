using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationProposals
{
    /// <summary>
    /// Borra una propuesta guardada de un partido. No cambia la convocatoria.
    /// DELETE /api/events/{eventId}/deconvocation-proposals/{proposalId}
    /// </summary>
    public class DeleteSavedDeconvocationProposal : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete($"{DeconvocationProposalsConstants.BaseRoute}/{{proposalId}}",
                    [Authorize(Roles = DeconvocationProposalsConstants.Roles)] async (string eventId, string proposalId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new Command(eventId, proposalId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteSavedDeconvocationProposal))
                .WithTags(DeconvocationProposalsConstants.Tag)
                .Produces(StatusCodes.Status204NoContent)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Command(string EventId, string ProposalId) : RFFM.Api.Common.ICommand;

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Command, Unit>
        {
            public async ValueTask<Unit> Handle(Command request, CancellationToken cancellationToken)
            {
                await DeconvocationProposalsSupport.RequireManagedEventTeamAsync(db, currentUser, request.EventId, cancellationToken);

                var proposal = await db.DeconvocationSavedProposals.SingleOrDefaultAsync(
                        p => p.Id == request.ProposalId && p.SportEventId == request.EventId, cancellationToken)
                    ?? throw new NotFoundException("Propuesta no encontrada.", ErrorCodes.DeconvocationProposalNotFound);

                db.DeconvocationSavedProposals.Remove(proposal);
                await db.SaveChangesAsync(cancellationToken);
                return Unit.Value;
            }
        }
    }
}
