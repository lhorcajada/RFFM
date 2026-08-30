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
    /// Returns the full game model for a team and season, following the ADN hierarchy:
    /// Principio → Subprincipio → (Zona 0..N | direct) → SubSubPrincipio → Habilidad, with Notas
    /// nested at whichever level they anchor to, plus flat SetPieceRules and OpenIssues.
    /// GET /api/game-models?teamId={teamId}&amp;season={season}
    /// </summary>
    public class GetGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/game-models",
                    async (string teamId, string season, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var result = await mediator.Send(new GameModelQuery(teamId, season, userId), cancellationToken);
                        return result is null ? Results.NotFound() : Results.Ok(result);
                    })
                .WithName(nameof(GetGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces<GameModelResponse>()
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record GameModelQuery(string TeamId, string Season, string UserId) : IRequest<GameModelResponse?>, IRequireFeaturePermission
        {
            public string FeatureRoute => CoachFeatureRoutes.GameModel;
            public string RequiredPermission => "Read";
        }

        // ── Response DTOs ────────────────────────────────────────────────────────

        public record GameModelResponse(
            string Id,
            string TeamId,
            string Name,
            string Season,
            IEnumerable<PrincipleResponse> Principles,
            IEnumerable<SetPieceRuleResponse> SetPieceRules,
            IEnumerable<OpenIssueResponse> OpenIssues);

        public record PrincipleResponse(
            string Id,
            int GameMomentId,
            string GameMomentName,
            string Key,
            int Numero,
            string Titulo,
            string Texto,
            IEnumerable<SubprincipioResponse> Subprincipios,
            IEnumerable<NotaResponse> Notas);

        public record SubprincipioResponse(
            string Id,
            string Key,
            string Numero,
            string Titulo,
            string Texto,
            IEnumerable<ZonaResponse> Zonas,
            IEnumerable<SubSubPrincipioResponse> SubSubPrincipios,
            IEnumerable<NotaResponse> Notas);

        public record ZonaResponse(
            string Id,
            string Key,
            string ZoneKeysCsv,
            string? Label,
            string? ZonaTexto,
            string Texto,
            IEnumerable<SubSubPrincipioResponse> SubSubPrincipios,
            IEnumerable<NotaResponse> Notas);

        public record SubSubPrincipioResponse(
            string Id,
            string Key,
            string Numero,
            string Rol,
            string Texto,
            IEnumerable<HabilidadResponse> Habilidades,
            IEnumerable<NotaResponse> Notas);

        public record HabilidadResponse(string Id, string Nombre, string Descripcion, string Entrenable, string? ReferenciaAKey);

        public record NotaResponse(string Id, string Tipo, string Texto);

        public record SetPieceRuleResponse(string Id, string Subtype, string Texto);

        public record OpenIssueResponse(string Id, string Topic, string Description, string Status);

        // ── Handler ──────────────────────────────────────────────────────────────

        public class Handler : IRequestHandler<GameModelQuery, GameModelResponse?>
        {
            private readonly AppDbContext _db;
            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<GameModelResponse?> Handle(GameModelQuery request, CancellationToken cancellationToken = default)
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
                        .ThenInclude(p => p.GameMoment)
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.Subprincipios)
                            .ThenInclude(sp => sp.Zonas)
                                .ThenInclude(z => z.SubSubPrincipios)
                                    .ThenInclude(ssp => ssp.Habilidades)
                    .Include(gm => gm.Principles)
                        .ThenInclude(p => p.Subprincipios)
                            .ThenInclude(sp => sp.SubSubPrincipios)
                                .ThenInclude(ssp => ssp.Habilidades)
                    .Include(gm => gm.Notas)
                    .Include(gm => gm.SetPieceRules)
                    .Include(gm => gm.OpenIssues)
                    .AsSplitQuery()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(gm => gm.TeamId == request.TeamId && gm.Season == request.Season, cancellationToken);

                if (model is null)
                    return null;

                var notas = model.Notas;

                IEnumerable<NotaResponse> NotasFor(Func<Nota, bool> predicate) =>
                    notas.Where(predicate).Select(n => new NotaResponse(n.Id, n.Tipo, n.Texto));

                SubSubPrincipioResponse MapSsp(SubSubPrincipio ssp) => new(
                    ssp.Id,
                    ssp.Key,
                    ssp.Numero,
                    ssp.Rol,
                    ssp.Texto,
                    ssp.Habilidades.Select(h => new HabilidadResponse(h.Id, h.Nombre, h.Descripcion, h.Entrenable, h.ReferenciaAKey)),
                    NotasFor(n => n.SubSubPrincipioId == ssp.Id));

                ZonaResponse MapZona(Zona z) => new(
                    z.Id,
                    z.Key,
                    z.ZoneKeysCsv,
                    z.Label,
                    z.ZonaTexto,
                    z.Texto,
                    z.SubSubPrincipios.Select(MapSsp),
                    NotasFor(n => n.ZonaId == z.Id));

                SubprincipioResponse MapSubprincipio(Subprincipio sp) => new(
                    sp.Id,
                    sp.Key,
                    sp.Numero,
                    sp.Titulo,
                    sp.Texto,
                    sp.Zonas.Select(MapZona),
                    sp.SubSubPrincipios.Select(MapSsp),
                    NotasFor(n => n.SubprincipioId == sp.Id));

                PrincipleResponse MapPrincipio(GamePrinciple p) => new(
                    p.Id,
                    p.GameMomentId,
                    p.GameMoment.Name,
                    p.Key,
                    p.Numero,
                    p.Titulo,
                    p.Texto,
                    p.Subprincipios.Select(MapSubprincipio),
                    NotasFor(n => n.PrincipioId == p.Id));

                return new GameModelResponse(
                    model.Id,
                    model.TeamId,
                    model.Name,
                    model.Season,
                    model.Principles
                        .OrderBy(p => p.GameMomentId)
                        .ThenBy(p => p.Numero)
                        .Select(MapPrincipio),
                    model.SetPieceRules.Select(s => new SetPieceRuleResponse(s.Id, s.Subtype, s.Texto)),
                    model.OpenIssues.Select(o => new OpenIssueResponse(o.Id, o.Topic, o.Description, o.Status))
                );
            }
        }
    }
}
