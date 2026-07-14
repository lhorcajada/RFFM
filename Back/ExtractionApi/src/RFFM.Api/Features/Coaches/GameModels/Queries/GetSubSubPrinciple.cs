using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    /// <summary>
    /// Returns a sub-sub-principle with its essential skills.
    /// GET /api/game-models/sub-sub-principles/{sspId}
    /// </summary>
    public class GetSubSubPrinciple : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models/sub-sub-principles/{sspId}",
                    async (string sspId, HttpContext httpContext, IMediator mediator, CancellationToken ct) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        var result = await mediator.Send(new GetSubSubPrincipleQuery(sspId, userId), ct);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetSubSubPrinciple))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<SubSubPrincipleDetail>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound);
        }
    }

    public record GetSubSubPrincipleQuery(string SspId, string UserId) : IRequest<SubSubPrincipleDetail?>, IRequireFeaturePermission
    {
        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "Read";
    }

    public record SubSubPrincipleSkillItem(string Id, string Name, string Description, DateTime? MasteredAt);

    public record SubSubPrincipleDetail(
        string Id,
        string Name,
        string Action,
        IEnumerable<SubSubPrincipleSkillItem> EssentialSkills);

    public class GetSubSubPrincipleHandler : IRequestHandler<GetSubSubPrincipleQuery, SubSubPrincipleDetail?>
    {
        private readonly AppDbContext _db;
        public GetSubSubPrincipleHandler(AppDbContext db) => _db = db;

        public async ValueTask<SubSubPrincipleDetail?> Handle(GetSubSubPrincipleQuery request, CancellationToken ct = default)
        {
            // Verify the user has access via the club chain
            var hasAccess = await _db.SubSubPrinciples
                .Where(ssp => ssp.Id == request.SspId)
                .Join(_db.SubPrinciples, ssp => ssp.SubPrincipleId, sp => sp.Id, (ssp, sp) => sp)
                .Join(_db.GameScenarios, sp => sp.GameScenarioId, gs => gs.Id, (sp, gs) => gs)
                .Join(_db.GameModels, gs => gs.GameModelId, gm => gm.Id, (gs, gm) => gm)
                .Join(_db.Teams, gm => gm.TeamId, t => t.Id, (gm, t) => t)
                .Join(_db.UserClubs, t => t.ClubId, uc => uc.ClubId, (t, uc) => uc)
                .AnyAsync(uc => uc.ApplicationUserId == request.UserId, ct);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este sub-subprincipio.", ErrorCodes.SubSubPrincipleAccessDenied);

            var ssp = await _db.SubSubPrinciples
                .Include(x => x.EssentialSkills)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.SspId, ct);

            if (ssp is null) return null;

            return new SubSubPrincipleDetail(
                ssp.Id,
                ssp.Name,
                ssp.Action,
                ssp.EssentialSkills.Select(sk =>
                    new SubSubPrincipleSkillItem(sk.Id, sk.Name, sk.Description, sk.MasteredAt)));
        }
    }
}
