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
    /// Creates a new game model for a team and season, following the ADN hierarchy:
    /// Principio → Subprincipio → (Zona, 0..N) → SubSubPrincipio → Habilidad, plus Notas
    /// anchored per level, flat SetPieceRules and OpenIssues.
    /// POST /api/game-models
    /// </summary>
    public class CreateGameModel : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/game-models",
                    async (CreateGameModelCommand command, HttpContext httpContext, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims
                            .FirstOrDefault(c => c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                            return Results.Unauthorized();

                        var id = await mediator.Send(command with { UserId = userId }, cancellationToken);
                        return Results.Created($"/api/game-models?teamId={command.TeamId}&season={command.Season}", new { id });
                    })
                .WithName(nameof(CreateGameModel))
                .WithTags(GameModelConstants.Tag)
                .RequireAuthorization()
                .Produces(StatusCodes.Status201Created)
                .Produces(StatusCodes.Status401Unauthorized)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }
    }

    // ── Request ──────────────────────────────────────────────────────────────────

    public record CreateGameModelCommand(
        string TeamId,
        string Name,
        string Season,
        List<PrincipleRequest> Principles,
        List<SetPieceRuleRequest> SetPieceRules,
        List<OpenIssueRequest> OpenIssues) : IRequest<string>, IRequireFeaturePermission
    {
        public string UserId { get; init; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.GameModel;
        public string RequiredPermission => "ReadWrite";
    }

    public record PrincipleRequest(
        string? Id,
        int GameMomentId,
        int Numero,
        string Titulo,
        string Texto,
        List<SubprincipioRequest> Subprincipios,
        List<NotaRequest> Notas);

    public record SubprincipioRequest(
        string? Id,
        string Numero,
        string Titulo,
        string Texto,
        List<ZonaRequest> Zonas,
        List<SubSubPrincipioRequest> SubSubPrincipios,
        List<NotaRequest> Notas);

    public record ZonaRequest(
        string? Id,
        string ZoneKeysCsv,
        string? Label,
        string? ZonaTexto,
        string Texto,
        List<SubSubPrincipioRequest> SubSubPrincipios,
        List<NotaRequest> Notas);

    public record SubSubPrincipioRequest(
        string? Id,
        string Numero,
        string Rol,
        string Texto,
        List<HabilidadRequest> Habilidades,
        List<NotaRequest> Notas);

    public record HabilidadRequest(string? Id, string Nombre, string Descripcion, string Entrenable, string? ReferenciaAKey);

    public record NotaRequest(string? Id, string Tipo, string Texto);

    public record SetPieceRuleRequest(string? Id, string Subtype, string Texto);

    public record OpenIssueRequest(string? Id, string Topic, string Description, string Status);

    // ── Handler ──────────────────────────────────────────────────────────────────

    public class CreateGameModelHandler : IRequestHandler<CreateGameModelCommand, string>
    {
        private readonly AppDbContext _db;
        public CreateGameModelHandler(AppDbContext db) => _db = db;

        public async ValueTask<string> Handle(CreateGameModelCommand request, CancellationToken cancellationToken = default)
        {
            var hasAccess = await _db.UserClubs
                .Join(_db.Teams, uc => uc.ClubId, t => t.ClubId, (uc, t) => new { uc, t })
                .AnyAsync(x => x.uc.ApplicationUserId == request.UserId && x.t.Id == request.TeamId, cancellationToken);

            if (!hasAccess)
                throw new DomainException("Modelo de Juego", "No tienes acceso a este equipo.", ErrorCodes.TeamAccessDenied);

            var exists = await _db.GameModels
                .AnyAsync(gm => gm.TeamId == request.TeamId && gm.Season == request.Season, cancellationToken);

            if (exists)
                throw new DomainException("Modelo de Juego",
                    $"Ya existe un modelo de juego para la temporada {request.Season}.", ErrorCodes.GameModelAlreadyExists);

            var model = new GameModel(request.TeamId, request.Name, request.Season);

            foreach (var pr in request.Principles)
                model.Principles.Add(BuildPrinciple(model.Id, pr, model.Notas));

            foreach (var spr in request.SetPieceRules)
                model.SetPieceRules.Add(new SetPieceRule(model.Id, spr.Subtype, spr.Texto));

            foreach (var oir in request.OpenIssues)
                model.OpenIssues.Add(new OpenIssue(model.Id, oir.Topic, oir.Description, oir.Status));

            await _db.GameModels.AddAsync(model, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);

            return model.Id;
        }

        internal static GamePrinciple BuildPrinciple(string gameModelId, PrincipleRequest pr, List<Nota> notas)
        {
            var faseSlug = GameModelKeys.FaseSlugsById[pr.GameMomentId];
            var key = GameModelKeys.BuildPrincipioKey(faseSlug, pr.Numero);
            var principle = new GamePrinciple(gameModelId, pr.GameMomentId, key, pr.Numero, pr.Titulo, pr.Texto);

            foreach (var spr in pr.Subprincipios)
                principle.Subprincipios.Add(BuildSubprincipio(principle.Id, faseSlug, spr, gameModelId, notas));

            foreach (var nr in pr.Notas)
                notas.Add(new Nota(gameModelId, nr.Tipo, nr.Texto, principle.Id, null, null, null));

            return principle;
        }

        private static Subprincipio BuildSubprincipio(string gamePrincipleId, string faseSlug, SubprincipioRequest spr, string gameModelId, List<Nota> notas)
        {
            var key = GameModelKeys.BuildSubprincipioKey(faseSlug, spr.Numero);
            var sp = new Subprincipio(gamePrincipleId, key, spr.Numero, spr.Titulo, spr.Texto);

            foreach (var zr in spr.Zonas)
                sp.Zonas.Add(BuildZona(sp.Id, faseSlug, spr.Numero, zr, gameModelId, notas));

            foreach (var sspr in spr.SubSubPrincipios)
                sp.SubSubPrincipios.Add(BuildSubSubPrincipio(faseSlug, sspr, subprincipioId: sp.Id, zonaId: null, gameModelId, notas));

            foreach (var nr in spr.Notas)
                notas.Add(new Nota(gameModelId, nr.Tipo, nr.Texto, null, sp.Id, null, null));

            return sp;
        }

        private static Zona BuildZona(string subprincipioId, string faseSlug, string subprincipioNumero, ZonaRequest zr, string gameModelId, List<Nota> notas)
        {
            var key = GameModelKeys.BuildZonaKey(faseSlug, subprincipioNumero, zr.ZoneKeysCsv, zr.Label);
            var zona = new Zona(subprincipioId, key, zr.ZoneKeysCsv, zr.Label, zr.ZonaTexto, zr.Texto);

            foreach (var sspr in zr.SubSubPrincipios)
                zona.SubSubPrincipios.Add(BuildSubSubPrincipio(faseSlug, sspr, subprincipioId: null, zonaId: zona.Id, gameModelId, notas));

            foreach (var nr in zr.Notas)
                notas.Add(new Nota(gameModelId, nr.Tipo, nr.Texto, null, null, zona.Id, null));

            return zona;
        }

        private static SubSubPrincipio BuildSubSubPrincipio(string faseSlug, SubSubPrincipioRequest sspr, string? subprincipioId, string? zonaId, string gameModelId, List<Nota> notas)
        {
            var key = GameModelKeys.BuildSubSubPrincipioKey(faseSlug, sspr.Numero);
            var ssp = new SubSubPrincipio(key, sspr.Numero, sspr.Rol, sspr.Texto, subprincipioId, zonaId);

            foreach (var hr in sspr.Habilidades)
                ssp.Habilidades.Add(new Habilidad(ssp.Id, hr.Nombre, hr.Descripcion, hr.Entrenable, hr.ReferenciaAKey));

            foreach (var nr in sspr.Notas)
                notas.Add(new Nota(gameModelId, nr.Tipo, nr.Texto, null, null, null, ssp.Id));

            return ssp;
        }
    }

    // ── Validator ────────────────────────────────────────────────────────────────

    public class CreateGameModelValidator : AbstractValidator<CreateGameModelCommand>
    {
        public CreateGameModelValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.Season).NotEmpty().MaximumLength(20);

            RuleForEach(x => x.Principles).SetValidator(new PrincipleRequestValidator());
            RuleForEach(x => x.SetPieceRules).SetValidator(new SetPieceRuleRequestValidator());
        }
    }

    public class PrincipleRequestValidator : AbstractValidator<PrincipleRequest>
    {
        public PrincipleRequestValidator()
        {
            RuleFor(x => x.Titulo).NotEmpty();
            RuleFor(x => x.GameMomentId).Must(id => GameModelKeys.FaseSlugsById.ContainsKey(id))
                .WithMessage("GameMomentId must be one of the 5 Fase catalog values.");
            RuleForEach(x => x.Subprincipios).SetValidator(new SubprincipioRequestValidator());
        }
    }

    public class SubprincipioRequestValidator : AbstractValidator<SubprincipioRequest>
    {
        public SubprincipioRequestValidator()
        {
            RuleFor(x => x.Titulo).NotEmpty();
            RuleFor(x => x.Numero).NotEmpty();
            RuleForEach(x => x.Zonas).SetValidator(new ZonaRequestValidator());
            RuleForEach(x => x.SubSubPrincipios).SetValidator(new SubSubPrincipioRequestValidator());
        }
    }

    public class ZonaRequestValidator : AbstractValidator<ZonaRequest>
    {
        public ZonaRequestValidator()
        {
            RuleFor(x => x.ZoneKeysCsv).NotEmpty();
            RuleForEach(x => x.SubSubPrincipios).SetValidator(new SubSubPrincipioRequestValidator());
        }
    }

    public class SubSubPrincipioRequestValidator : AbstractValidator<SubSubPrincipioRequest>
    {
        public SubSubPrincipioRequestValidator()
        {
            RuleFor(x => x.Numero).NotEmpty();
            RuleFor(x => x.Rol).NotEmpty();
            RuleForEach(x => x.Habilidades).SetValidator(new HabilidadRequestValidator());
        }
    }

    public class HabilidadRequestValidator : AbstractValidator<HabilidadRequest>
    {
        public HabilidadRequestValidator()
        {
            RuleFor(x => x.Nombre)
                .Must(n => Habilidad.Vocabulary.Contains(n))
                .WithMessage("Nombre must be one of the 15-value Habilidad closed vocabulary.");
        }
    }

    public class SetPieceRuleRequestValidator : AbstractValidator<SetPieceRuleRequest>
    {
        public SetPieceRuleRequestValidator()
        {
            RuleFor(x => x.Subtype)
                .Must(s => SetPieceRule.Subtypes.Contains(s))
                .WithMessage("Subtype must be one of the Balón Parado closed vocabulary.");
        }
    }
}
