using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// El entrenador abre la quiniela de la siguiente jornada RFFM del grupo del equipo.
    /// POST /api/teams/{teamId}/quiniela
    /// See openspec/changes/quiniela-team-pool/design.md → D6, D7.
    /// </summary>
    public class OpenQuiniela : IFeatureModule
    {
        private const decimal TicketPrice = 1m;
        private const decimal PrizePercent = 55m;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost(QuinielaConstants.BaseRoute,
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                    {
                        var jornada = await mediator.Send(new Command(teamId), ct);
                        return Results.Created($"/api/teams/{teamId}/quiniela/current", jornada);
                    })
                .WithName(nameof(OpenQuiniela))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaJornadaDto>(StatusCodes.Status201Created)
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);
        }

        public record Command(string TeamId) : RFFM.Api.Common.ICommand<QuinielaJornadaDto>;

        public class Validator : AbstractValidator<Command>
        {
            public Validator() => RuleFor(c => c.TeamId).NotEmpty();
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaJornadaDto>
        {
            public async ValueTask<QuinielaJornadaDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.CoachOnly, cancellationToken);

                var groupId = await db.Teams.AsNoTracking()
                    .Where(t => t.Id == request.TeamId && t.RffmCompetitionId != null)
                    .Select(t => t.RffmGroupId)
                    .SingleOrDefaultAsync(cancellationToken);
                if (groupId is null)
                    throw new ConflictException("El equipo no tiene una competición RFFM configurada.", ErrorCodes.QuinielaTeamWithoutLeague);

                var existing = await db.QuinielaJornadas.AsNoTracking()
                    .Where(j => j.TeamId == request.TeamId)
                    .Select(j => new { j.RffmRoundId, j.Status, j.CarryOut, j.SettledAt })
                    .ToListAsync(cancellationToken);
                if (existing.Any(j => j.Status == QuinielaJornadaStatus.Open))
                    throw new ConflictException("Ya hay una quiniela abierta: liquídala antes de abrir la siguiente.", ErrorCodes.QuinielaAlreadyOpen);

                var openedRoundIds = existing.Select(j => j.RffmRoundId).ToHashSet();
                var groupCode = groupId.Value.ToString();
                var rounds = await federationDb.RffmRounds.AsNoTracking()
                    .Where(r => r.GroupCode == groupCode)
                    .OrderBy(r => r.Number)
                    .ToListAsync(cancellationToken);

                var highestOpenedNumber = rounds.Where(r => openedRoundIds.Contains(r.Id)).Select(r => r.Number).DefaultIfEmpty(0).Max();
                var candidateIds = rounds.Where(r => r.Number > highestOpenedNumber).Select(r => r.Id).ToList();
                var matches = (await federationDb.RffmMatches.AsNoTracking()
                        .Where(m => candidateIds.Contains(m.RffmRoundId))
                        .ToListAsync(cancellationToken))
                    .ToLookup(m => m.RffmRoundId);

                var next = rounds
                    .Where(r => r.Number > highestOpenedNumber)
                    .FirstOrDefault(r => matches[r.Id].Any(m => QuinielaMatchValidity.IsValid(m) && !m.IsFinal))
                    ?? throw new NotFoundException("No hay una próxima jornada con partidos pendientes.", ErrorCodes.QuinielaNoNextRound);

                var carryIn = existing.Where(j => j.Status == QuinielaJornadaStatus.Settled)
                    .OrderByDescending(j => j.SettledAt)
                    .Select(j => j.CarryOut)
                    .FirstOrDefault() ?? 0m;

                var jornada = QuinielaJornada.Create(request.TeamId, next.Id, carryIn, TicketPrice, PrizePercent);
                db.QuinielaJornadas.Add(jornada);
                await db.SaveChangesAsync(cancellationToken);

                var round = new QuinielaRound(next, matches[next.Id].ToList());
                return QuinielaSupport.ToDto(jornada, round, timeProvider.GetUtcNow().UtcDateTime);
            }
        }
    }
}
