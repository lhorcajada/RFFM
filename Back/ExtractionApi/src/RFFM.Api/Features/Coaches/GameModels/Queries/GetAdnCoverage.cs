using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.GameModels.Queries
{
    /// <summary>
    /// Returns, for every Sub-subprincipio/Zona/Subprincipio/Principio of a team's game model,
    /// its coverage status by TrainingSession targets (scheduled or not), plus which sessions
    /// reference each Sub-subprincipio — the data source for the content-board's coverage
    /// checkmarks and usage badges (design.md Decision 5 of `season-plan-content-board`).
    /// Sub-subprincipio coverage stays boolean (<see cref="SubSubPrincipioCoverage.IsUsed"/>).
    /// Zona, Subprincipio and Principio use a three-value <see cref="AdnCoverageStatuses"/>
    /// status, aggregated bottom-up: a Zona is "completed" only when all its direct
    /// Sub-subprincipios are used, "in-progress" when at least one is, "not-started" otherwise.
    /// A Subprincipio with Zonas aggregates over its Zonas' statuses (not over the flattened
    /// Sub-subprincipios); a Subprincipio without Zonas aggregates directly over its
    /// Sub-subprincipios the same way a Zona does. A Principio aggregates over its
    /// Subprincipios' statuses using the same rule.
    /// GET /api/game-models/adn-coverage?teamId={teamId}&amp;season={season}
    /// </summary>
    public class GetAdnCoverage : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models/adn-coverage",
                    async (string teamId, string season, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new AdnCoverageQuery(teamId, season, userId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetAdnCoverage))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<AdnCoverageResponse>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record AdnCoverageQuery(string TeamId, string Season, string UserId) : IRequest<AdnCoverageResponse?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        // ── Coverage status constants ───────────────────────────────────────────

        /// <summary>
        /// Three-value coverage status shared by Zona, Subprincipio and Principio. Kept as
        /// string constants (not a C# enum) because this project has no
        /// <c>JsonStringEnumConverter</c> configured, so a plain enum would serialize as a
        /// number — see <see cref="RFFM.Api.Domain.Entities.OpenIssue"/>'s Status for the same
        /// pattern already used in this codebase.
        /// </summary>
        public static class AdnCoverageStatuses
        {
            public const string NotStarted = "not-started";
            public const string InProgress = "in-progress";
            public const string Completed = "completed";
        }

        // ── Response DTOs ────────────────────────────────────────────────────────

        public record AdnCoverageResponse(
            IEnumerable<SubSubPrincipioCoverage> SubSubPrincipios,
            IEnumerable<ZonaCoverage> Zonas,
            IEnumerable<SubprincipioCoverage> Subprincipios,
            IEnumerable<PrincipioCoverage> Principios);

        public record SubSubPrincipioCoverage(string SubSubPrincipioId, bool IsUsed, IEnumerable<SessionUsage> Sessions);

        public record SessionUsage(string SessionId, string SessionName, DateTime? Date);

        public record ZonaCoverage(string ZonaId, string Status);

        public record SubprincipioCoverage(string SubprincipioId, string Status);

        public record PrincipioCoverage(string PrincipioId, string Status);

        // ── Handler ──────────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<AdnCoverageQuery, AdnCoverageResponse?>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<AdnCoverageResponse?> Handle(AdnCoverageQuery request, CancellationToken cancellationToken = default)
            {
                var hasClubAccess = await _db.UserClubs
                    .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                    .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

                var hasTeamAccess = hasClubAccess || await _db.UserTeams
                    .AnyAsync(ut => ut.ApplicationUserId == request.UserId && ut.TeamId == request.TeamId, cancellationToken);

                if (!hasTeamAccess)
                    throw new DomainException("Modelo de Juego", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

                var model = await _db.GameModels
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.Subprincipios)
                            .ThenInclude(sp => sp.Zonas)
                                .ThenInclude(z => z.SubSubPrincipios)
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.Subprincipios)
                            .ThenInclude(sp => sp.SubSubPrincipios)
                    .AsSplitQuery()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(gm => gm.TeamId == request.TeamId && gm.Season == request.Season, cancellationToken);

                if (model is null)
                    return null;

                var sessions = await _db.TrainingSessions
                    .Include(s => s.Targets)
                    .AsNoTracking()
                    .Where(s => s.TeamId == request.TeamId)
                    .ToListAsync(cancellationToken);

                var usagesBySubSubPrincipio = sessions
                    .SelectMany(s => s.Targets.Select(t => (t.SubSubPrincipioId, Usage: new SessionUsage(s.Id, s.Name, s.Date))))
                    .GroupBy(x => x.SubSubPrincipioId, x => x.Usage)
                    .ToDictionary(g => g.Key, g => (IEnumerable<SessionUsage>)g.ToList());

                SubSubPrincipioCoverage MapSsp(SubSubPrincipio ssp)
                {
                    var usages = usagesBySubSubPrincipio.GetValueOrDefault(ssp.Id, Enumerable.Empty<SessionUsage>());
                    return new SubSubPrincipioCoverage(ssp.Id, usages.Any(), usages);
                }

                var sspCoverages = new List<SubSubPrincipioCoverage>();
                var zonaCoverages = new List<ZonaCoverage>();
                var subprincipioCoverages = new List<SubprincipioCoverage>();
                var principioCoverages = new List<PrincipioCoverage>();

                foreach (var principio in model.Principles)
                {
                    var subprincipioStatuses = new List<string>();

                    foreach (var subprincipio in principio.Subprincipios)
                    {
                        string subprincipioStatus;

                        if (subprincipio.Zonas.Count > 0)
                        {
                            var zonaStatuses = new List<string>();

                            foreach (var zona in subprincipio.Zonas)
                            {
                                var mapped = zona.SubSubPrincipios.Select(MapSsp).ToList();
                                sspCoverages.AddRange(mapped);

                                var zonaStatus = AggregateStatus(mapped.Select(m => m.IsUsed));
                                zonaCoverages.Add(new ZonaCoverage(zona.Id, zonaStatus));
                                zonaStatuses.Add(zonaStatus);
                            }

                            subprincipioStatus = AggregateStatusFromChildren(zonaStatuses);
                        }
                        else
                        {
                            var mapped = subprincipio.SubSubPrincipios.Select(MapSsp).ToList();
                            sspCoverages.AddRange(mapped);

                            subprincipioStatus = AggregateStatus(mapped.Select(m => m.IsUsed));
                        }

                        subprincipioCoverages.Add(new SubprincipioCoverage(subprincipio.Id, subprincipioStatus));
                        subprincipioStatuses.Add(subprincipioStatus);
                    }

                    principioCoverages.Add(new PrincipioCoverage(principio.Id, AggregateStatusFromChildren(subprincipioStatuses)));
                }

                return new AdnCoverageResponse(sspCoverages, zonaCoverages, subprincipioCoverages, principioCoverages);

                static string AggregateStatus(IEnumerable<bool> leafUsages) =>
                    AggregateStatusFromChildren(leafUsages.Select(used => used ? AdnCoverageStatuses.Completed : AdnCoverageStatuses.NotStarted));

                static string AggregateStatusFromChildren(IEnumerable<string> childStatuses)
                {
                    var list = childStatuses.ToList();
                    if (list.Count == 0)
                        return AdnCoverageStatuses.NotStarted;
                    if (list.All(s => s == AdnCoverageStatuses.Completed))
                        return AdnCoverageStatuses.Completed;
                    if (list.Any(s => s != AdnCoverageStatuses.NotStarted))
                        return AdnCoverageStatuses.InProgress;
                    return AdnCoverageStatuses.NotStarted;
                }
            }
        }
    }
}
