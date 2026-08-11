using FluentValidation;
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

namespace RFFM.Api.Features.Coaches.GameModels.Commands
{
    /// <summary>
    /// Replaces the full ADN tree (principles, notas, set-piece rules, open issues) of an
    /// existing game model. Upserts nodes by id where provided; nodes no longer present are
    /// removed, cascading to their descendants.
    /// PUT /api/game-models/{id}
    /// </summary>
    public class UpdateGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/game-models/{id}",
                    async (string id, UpdateGameModelCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        await mediator.Send(command with { Id = id, UserId = userId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(UpdateGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record UpdateGameModelCommand(
        string Name,
        List<PrincipleRequest> Principles,
        List<SetPieceRuleRequest> SetPieceRules,
        List<OpenIssueRequest> OpenIssues) : IRequest, IRequireFeaturePermission
    {
        public string Id { get; init; } = string.Empty;
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class UpdateGameModelHandler : IRequestHandler<UpdateGameModelCommand, Unit>
    {
        private readonly AppDbContext _db;
        public UpdateGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<Unit> Handle(UpdateGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var model = await _db.GameModels
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
                .FirstOrDefaultAsync(gm => gm.Id == request.Id, cancellationToken);

            if (model is null)
                throw new DomainException("Modelo de Juego", "Modelo de juego no encontrado.", ErrorCodes.GameModelNotFound);

            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == model.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este modelo de juego.", ErrorCodes.GameModelAccessDenied);

            model.UpdateName(request.Name);

            // ── Upsert principles (and everything nested under them, including notas) ─────
            var matchedPrincipleIds = new HashSet<string>();
            var matchedNotaIds = new HashSet<string>();

            foreach (var pr in request.Principles)
            {
                var faseSlug = GameModelKeys.FaseSlugsById[pr.GameMomentId];
                var key = GameModelKeys.BuildPrincipioKey(faseSlug, pr.Numero);

                var existing = string.IsNullOrEmpty(pr.Id)
                    ? model.Principles.FirstOrDefault(p => p.Key == key)
                    : model.Principles.FirstOrDefault(p => p.Id == pr.Id);

                if (existing is not null)
                {
                    matchedPrincipleIds.Add(existing.Id);
                    existing.UpdateKey(key);
                    existing.UpdateNumero(pr.Numero);
                    existing.UpdateTitulo(pr.Titulo);
                    existing.UpdateTexto(pr.Texto);

                    UpsertSubprincipios(existing, faseSlug, pr.Subprincipios, model, matchedNotaIds);
                    UpsertNotas(model, matchedNotaIds, pr.Notas, principioId: existing.Id);
                }
                else
                {
                    var newPrinciple = CreateGameModelHandler.BuildPrinciple(model.Id, pr, model.Notas);
                    model.Principles.Add(newPrinciple);
                    matchedPrincipleIds.Add(newPrinciple.Id);
                    foreach (var n in model.Notas.Where(n => n.PrincipioId == newPrinciple.Id))
                        matchedNotaIds.Add(n.Id);
                    foreach (var sp in AllSubprincipios(newPrinciple))
                        foreach (var n in model.Notas.Where(n => n.SubprincipioId == sp.Id))
                            matchedNotaIds.Add(n.Id);
                    foreach (var z in AllZonas(newPrinciple))
                        foreach (var n in model.Notas.Where(n => n.ZonaId == z.Id))
                            matchedNotaIds.Add(n.Id);
                    foreach (var ssp in AllSubSubPrincipios(newPrinciple))
                        foreach (var n in model.Notas.Where(n => n.SubSubPrincipioId == ssp.Id))
                            matchedNotaIds.Add(n.Id);
                }
            }

            var principlesToRemove = model.Principles
                .Where(p => !matchedPrincipleIds.Contains(p.Id))
                .ToList();
            _db.GamePrinciples.RemoveRange(principlesToRemove);

            var notasToRemove = model.Notas
                .Where(n => !matchedNotaIds.Contains(n.Id))
                .ToList();
            _db.Notas.RemoveRange(notasToRemove);

            // ── Replace flat SetPieceRules and OpenIssues ──────────────────────────
            var matchedSetPieceRuleIds = new HashSet<string>();
            foreach (var spr in request.SetPieceRules)
            {
                var existing = string.IsNullOrEmpty(spr.Id)
                    ? model.SetPieceRules.FirstOrDefault(s => s.Subtype == spr.Subtype)
                    : model.SetPieceRules.FirstOrDefault(s => s.Id == spr.Id);

                if (existing is not null)
                {
                    matchedSetPieceRuleIds.Add(existing.Id);
                    existing.UpdateSubtype(spr.Subtype);
                    existing.UpdateTexto(spr.Texto);
                }
                else
                {
                    var newRule = new SetPieceRule(model.Id, spr.Subtype, spr.Texto);
                    model.SetPieceRules.Add(newRule);
                    matchedSetPieceRuleIds.Add(newRule.Id);
                }
            }
            _db.SetPieceRules.RemoveRange(model.SetPieceRules.Where(s => !matchedSetPieceRuleIds.Contains(s.Id)).ToList());

            var matchedOpenIssueIds = new HashSet<string>();
            foreach (var oir in request.OpenIssues)
            {
                var existing = string.IsNullOrEmpty(oir.Id)
                    ? null
                    : model.OpenIssues.FirstOrDefault(o => o.Id == oir.Id);

                if (existing is not null)
                {
                    matchedOpenIssueIds.Add(existing.Id);
                    existing.UpdateTopic(oir.Topic);
                    existing.UpdateDescription(oir.Description);
                    existing.UpdateStatus(oir.Status);
                }
                else
                {
                    var newIssue = new OpenIssue(model.Id, oir.Topic, oir.Description, oir.Status);
                    model.OpenIssues.Add(newIssue);
                    matchedOpenIssueIds.Add(newIssue.Id);
                }
            }
            _db.OpenIssues.RemoveRange(model.OpenIssues.Where(o => !matchedOpenIssueIds.Contains(o.Id)).ToList());

            await _db.SaveChangesAsync(cancellationToken);
            return Unit.Value;
        }

        private static IEnumerable<Subprincipio> AllSubprincipios(GamePrinciple p) => p.Subprincipios;
        private static IEnumerable<Zona> AllZonas(GamePrinciple p) => p.Subprincipios.SelectMany(sp => sp.Zonas);
        private static IEnumerable<SubSubPrincipio> AllSubSubPrincipios(GamePrinciple p) =>
            p.Subprincipios.SelectMany(sp => sp.SubSubPrincipios)
                .Concat(p.Subprincipios.SelectMany(sp => sp.Zonas).SelectMany(z => z.SubSubPrincipios));

        private static void UpsertNotas(GameModel model, HashSet<string> matchedNotaIds, List<NotaRequest> requests,
            string? principioId = null, string? subprincipioId = null, string? zonaId = null, string? subSubPrincipioId = null)
        {
            foreach (var nr in requests)
            {
                var existing = string.IsNullOrEmpty(nr.Id) ? null : model.Notas.FirstOrDefault(n => n.Id == nr.Id);
                if (existing is not null)
                {
                    matchedNotaIds.Add(existing.Id);
                    existing.UpdateTipo(nr.Tipo);
                    existing.UpdateTexto(nr.Texto);
                }
                else
                {
                    var newNota = new Nota(model.Id, nr.Tipo, nr.Texto, principioId, subprincipioId, zonaId, subSubPrincipioId);
                    model.Notas.Add(newNota);
                    matchedNotaIds.Add(newNota.Id);
                }
            }
        }

        // ── Upsert subprincipios inside an existing principle ──────────────────

        private void UpsertSubprincipios(GamePrinciple principle, string faseSlug, List<SubprincipioRequest> requests, GameModel model, HashSet<string> matchedNotaIds)
        {
            var matchedIds = new HashSet<string>();

            foreach (var spr in requests)
            {
                var key = GameModelKeys.BuildSubprincipioKey(faseSlug, spr.Numero);
                var existing = string.IsNullOrEmpty(spr.Id)
                    ? principle.Subprincipios.FirstOrDefault(sp => sp.Key == key)
                    : principle.Subprincipios.FirstOrDefault(sp => sp.Id == spr.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateKey(key);
                    existing.UpdateNumero(spr.Numero);
                    existing.UpdateTitulo(spr.Titulo);
                    existing.UpdateTexto(spr.Texto);

                    UpsertZonas(existing, faseSlug, spr.Numero, spr.Zonas, model, matchedNotaIds);
                    UpsertSubSubPrincipios(existing.SubSubPrincipios, faseSlug, spr.SubSubPrincipios, model, matchedNotaIds,
                        subprincipioId: existing.Id, zonaId: null, addTo: existing.SubSubPrincipios);
                    UpsertNotas(model, matchedNotaIds, spr.Notas, subprincipioId: existing.Id);
                }
                else
                {
                    var newSp = BuildSubprincipioForUpdate(principle.Id, faseSlug, spr, model);
                    principle.Subprincipios.Add(newSp);
                    matchedIds.Add(newSp.Id);
                    MarkNested(newSp, model, matchedNotaIds);
                }
            }

            var toRemove = principle.Subprincipios.Where(sp => !matchedIds.Contains(sp.Id)).ToList();
            _db.Subprincipios.RemoveRange(toRemove);
        }

        private static Subprincipio BuildSubprincipioForUpdate(string gamePrincipleId, string faseSlug, SubprincipioRequest spr, GameModel model)
        {
            var key = GameModelKeys.BuildSubprincipioKey(faseSlug, spr.Numero);
            var sp = new Subprincipio(gamePrincipleId, key, spr.Numero, spr.Titulo, spr.Texto);

            foreach (var zr in spr.Zonas)
            {
                var zKey = GameModelKeys.BuildZonaKey(faseSlug, spr.Numero, zr.ZoneKeysCsv, zr.Label);
                var zona = new Zona(sp.Id, zKey, zr.ZoneKeysCsv, zr.Label, zr.ZonaTexto, zr.Texto);
                foreach (var sspr in zr.SubSubPrincipios)
                    zona.SubSubPrincipios.Add(BuildSspForUpdate(faseSlug, sspr, subprincipioId: null, zonaId: zona.Id));
                sp.Zonas.Add(zona);
                foreach (var nr in zr.Notas)
                    model.Notas.Add(new Nota(model.Id, nr.Tipo, nr.Texto, null, null, zona.Id, null));
            }

            foreach (var sspr in spr.SubSubPrincipios)
                sp.SubSubPrincipios.Add(BuildSspForUpdate(faseSlug, sspr, subprincipioId: sp.Id, zonaId: null));

            return sp;
        }

        private static SubSubPrincipio BuildSspForUpdate(string faseSlug, SubSubPrincipioRequest sspr, string? subprincipioId, string? zonaId)
        {
            var key = GameModelKeys.BuildSubSubPrincipioKey(faseSlug, sspr.Numero);
            var ssp = new SubSubPrincipio(key, sspr.Numero, sspr.Rol, sspr.Texto, subprincipioId, zonaId);
            foreach (var hr in sspr.Habilidades)
                ssp.Habilidades.Add(new Habilidad(ssp.Id, hr.Nombre, hr.Descripcion, hr.Entrenable, hr.ReferenciaAKey));
            return ssp;
        }

        private static void MarkNested(Subprincipio sp, GameModel model, HashSet<string> matchedNotaIds)
        {
            foreach (var n in model.Notas.Where(n => n.SubprincipioId == sp.Id)) matchedNotaIds.Add(n.Id);
            foreach (var z in sp.Zonas)
            {
                foreach (var n in model.Notas.Where(n => n.ZonaId == z.Id)) matchedNotaIds.Add(n.Id);
                foreach (var ssp in z.SubSubPrincipios)
                    foreach (var n in model.Notas.Where(n => n.SubSubPrincipioId == ssp.Id)) matchedNotaIds.Add(n.Id);
            }
            foreach (var ssp in sp.SubSubPrincipios)
                foreach (var n in model.Notas.Where(n => n.SubSubPrincipioId == ssp.Id)) matchedNotaIds.Add(n.Id);
        }

        // ── Upsert zonas inside an existing subprincipio ───────────────────────

        private void UpsertZonas(Subprincipio sp, string faseSlug, string subprincipioNumero, List<ZonaRequest> requests, GameModel model, HashSet<string> matchedNotaIds)
        {
            var matchedIds = new HashSet<string>();

            foreach (var zr in requests)
            {
                var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipioNumero, zr.ZoneKeysCsv, zr.Label);
                var existing = string.IsNullOrEmpty(zr.Id)
                    ? sp.Zonas.FirstOrDefault(z => z.Key == key)
                    : sp.Zonas.FirstOrDefault(z => z.Id == zr.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateKey(key);
                    existing.UpdateZoneKeysCsv(zr.ZoneKeysCsv);
                    existing.UpdateLabel(zr.Label);
                    existing.UpdateZonaTexto(zr.ZonaTexto);
                    existing.UpdateTexto(zr.Texto);

                    UpsertSubSubPrincipios(existing.SubSubPrincipios, faseSlug, zr.SubSubPrincipios, model, matchedNotaIds,
                        subprincipioId: null, zonaId: existing.Id, addTo: existing.SubSubPrincipios);
                    UpsertNotas(model, matchedNotaIds, zr.Notas, zonaId: existing.Id);
                }
                else
                {
                    var zona = new Zona(sp.Id, key, zr.ZoneKeysCsv, zr.Label, zr.ZonaTexto, zr.Texto);
                    foreach (var sspr in zr.SubSubPrincipios)
                        zona.SubSubPrincipios.Add(BuildSspForUpdate(faseSlug, sspr, subprincipioId: null, zonaId: zona.Id));
                    sp.Zonas.Add(zona);
                    matchedIds.Add(zona.Id);
                    foreach (var ssp in zona.SubSubPrincipios)
                        foreach (var n in model.Notas.Where(n => n.SubSubPrincipioId == ssp.Id))
                            matchedNotaIds.Add(n.Id);
                    UpsertNotas(model, matchedNotaIds, zr.Notas, zonaId: zona.Id);
                }
            }

            var toRemove = sp.Zonas.Where(z => !matchedIds.Contains(z.Id)).ToList();
            _db.Zonas.RemoveRange(toRemove);
        }

        // ── Upsert sub-sub-principios inside an existing subprincipio/zona ─────

        private void UpsertSubSubPrincipios(List<SubSubPrincipio> current, string faseSlug, List<SubSubPrincipioRequest> requests,
            GameModel model, HashSet<string> matchedNotaIds, string? subprincipioId, string? zonaId, List<SubSubPrincipio> addTo)
        {
            var matchedIds = new HashSet<string>();

            foreach (var sspr in requests)
            {
                var key = GameModelKeys.BuildSubSubPrincipioKey(faseSlug, sspr.Numero);
                var existing = string.IsNullOrEmpty(sspr.Id)
                    ? current.FirstOrDefault(ssp => ssp.Key == key)
                    : current.FirstOrDefault(ssp => ssp.Id == sspr.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateKey(key);
                    existing.UpdateNumero(sspr.Numero);
                    existing.UpdateRol(sspr.Rol);
                    existing.UpdateTexto(sspr.Texto);
                    if (subprincipioId is not null && existing.SubprincipioId != subprincipioId)
                        existing.ReparentToSubprincipio(subprincipioId);
                    if (zonaId is not null && existing.ZonaId != zonaId)
                        existing.ReparentToZona(zonaId);

                    UpsertHabilidades(existing, sspr.Habilidades);
                    UpsertNotas(model, matchedNotaIds, sspr.Notas, subSubPrincipioId: existing.Id);
                }
                else
                {
                    var newSsp = BuildSspForUpdate(faseSlug, sspr, subprincipioId, zonaId);
                    addTo.Add(newSsp);
                    matchedIds.Add(newSsp.Id);
                    UpsertNotas(model, matchedNotaIds, sspr.Notas, subSubPrincipioId: newSsp.Id);
                }
            }

            var toRemove = current.Where(ssp => !matchedIds.Contains(ssp.Id)).ToList();
            _db.SubSubPrincipios.RemoveRange(toRemove);
        }

        // ── Upsert habilidades inside an existing sub-sub-principio ────────────

        private void UpsertHabilidades(SubSubPrincipio ssp, List<HabilidadRequest> requests)
        {
            var matchedIds = new HashSet<string>();

            foreach (var hr in requests)
            {
                var existing = string.IsNullOrEmpty(hr.Id)
                    ? ssp.Habilidades.FirstOrDefault(h => h.Nombre == hr.Nombre)
                    : ssp.Habilidades.FirstOrDefault(h => h.Id == hr.Id);

                if (existing is not null)
                {
                    matchedIds.Add(existing.Id);
                    existing.UpdateNombre(hr.Nombre);
                    existing.UpdateDescripcion(hr.Descripcion);
                    existing.UpdateEntrenable(hr.Entrenable);
                    existing.UpdateReferenciaAKey(hr.ReferenciaAKey);
                }
                else
                {
                    var newHabilidad = new Habilidad(ssp.Id, hr.Nombre, hr.Descripcion, hr.Entrenable, hr.ReferenciaAKey);
                    ssp.Habilidades.Add(newHabilidad);
                    matchedIds.Add(newHabilidad.Id);
                }
            }

            var toRemove = ssp.Habilidades.Where(h => !matchedIds.Contains(h.Id)).ToList();
            _db.Habilidades.RemoveRange(toRemove);
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class UpdateGameModelValidator : AbstractValidator<UpdateGameModelCommand>
    {
        public UpdateGameModelValidator()
        {
            RuleFor(x => x.Id).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);

            RuleForEach(x => x.Principles).SetValidator(new PrincipleRequestValidator());
            RuleForEach(x => x.SetPieceRules).SetValidator(new SetPieceRuleRequestValidator());
        }
    }
}
