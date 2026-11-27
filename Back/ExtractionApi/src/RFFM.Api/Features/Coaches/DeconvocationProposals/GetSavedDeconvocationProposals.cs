using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.DeconvocationProposals
{
    /// <summary>
    /// Propuestas de desconvocatoria guardadas de un partido, de la más antigua a la más reciente.
    /// GET /api/events/{eventId}/deconvocation-proposals
    /// </summary>
    public class GetSavedDeconvocationProposals : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet(DeconvocationProposalsConstants.BaseRoute,
                    [Authorize(Roles = DeconvocationProposalsConstants.Roles)] async (string eventId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(eventId), ct)))
                .WithName(nameof(GetSavedDeconvocationProposals))
                .WithTags(DeconvocationProposalsConstants.Tag)
                .Produces<SavedDeconvocationProposalsDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record Query(string EventId) : IQueryApp<SavedDeconvocationProposalsDto>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<Query, SavedDeconvocationProposalsDto>
        {
            public async ValueTask<SavedDeconvocationProposalsDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await DeconvocationProposalsSupport.RequireManagedEventTeamAsync(db, currentUser, request.EventId, cancellationToken);

                var proposals = await db.DeconvocationSavedProposals.AsNoTracking()
                    .Where(p => p.SportEventId == request.EventId)
                    .OrderBy(p => p.CreatedOn).ThenBy(p => p.Id)
                    .ToListAsync(cancellationToken);

                return new SavedDeconvocationProposalsDto(proposals
                    .Select(p => new SavedDeconvocationProposalDto(p.Id, p.Name, p.TeamPlayerIds, p.CreatedOn))
                    .ToList());
            }
        }
    }
}
