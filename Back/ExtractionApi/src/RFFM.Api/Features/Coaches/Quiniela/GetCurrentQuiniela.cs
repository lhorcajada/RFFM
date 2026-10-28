using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Quiniela
{
    /// <summary>
    /// Quiniela vigente del equipo para el participante: jornada, partidos (válidos y Pleno), mi boleto, bolsa y
    /// resultado anterior. Si no hay ninguna abierta devuelve <c>IsOpen = false</c> (sin efectos secundarios).
    /// GET /api/teams/{teamId}/quiniela/current
    /// See openspec/changes/quiniela-team-pool/design.md → D6, D7.
    /// </summary>
    public class GetCurrentQuiniela : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet($"{QuinielaConstants.BaseRoute}/current",
                    async (string teamId, IMediator mediator, CancellationToken ct) =>
                        Results.Ok(await mediator.Send(new Query(teamId), ct)))
                .WithName(nameof(GetCurrentQuiniela))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaCurrentDto>()
                .ProducesProblem(StatusCodes.Status403Forbidden);
        }

        public record Query(string TeamId) : IQueryApp<QuinielaCurrentDto>;

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Query, QuinielaCurrentDto>
        {
            public async ValueTask<QuinielaCurrentDto> Handle(Query request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var userId = currentUser.UserId!;
                var now = timeProvider.GetUtcNow().UtcDateTime;
                var canManage = await QuinielaSupport.IsCoachAsync(db, userId, request.TeamId, cancellationToken);

                var previous = await LoadPreviousAsync(request.TeamId, userId, cancellationToken);
                var open = await db.QuinielaJornadas.AsNoTracking()
                    .SingleOrDefaultAsync(j => j.TeamId == request.TeamId && j.Status == QuinielaJornadaStatus.Open, cancellationToken);
                if (open is null)
                    return new QuinielaCurrentDto(false, null, [], null, null, previous, canManage);

                var round = await QuinielaSupport.LoadRoundAsync(federationDb, open.RffmRoundId, cancellationToken);
                var plenoCode = round.PlenoRecordCode;
                var matches = round.Matches
                    .Select(m => new QuinielaMatchDto(
                        m.RecordCode, m.LocalTeamName, m.VisitorTeamName, QuinielaRound.KickoffOf(m), QuinielaMatchValidity.IsValid(m),
                        m.RecordCode == plenoCode,
                        m.IsFinal && int.TryParse(m.LocalGoals, out var home) ? home : null,
                        m.IsFinal && int.TryParse(m.VisitorGoals, out var away) ? away : null,
                        m.IsFinal))
                    .ToList();

                var tickets = await db.QuinielaTickets.AsNoTracking().Where(t => t.JornadaId == open.Id).ToListAsync(cancellationToken);
                var mine = tickets.FirstOrDefault(t => t.ApplicationUserId == userId);
                var paid = tickets.Count(t => t.PaymentStatus == QuinielaPaymentStatus.Paid);
                var collected = paid * open.Price;
                var pool = new QuinielaPoolDto(
                    tickets.Count, paid, collected, QuinielaSupport.SplitCollected(collected, open.PrizePercent).PrizeBase + open.CarryIn);

                return new QuinielaCurrentDto(
                    true, QuinielaSupport.ToDto(open, round, now), matches,
                    mine is null ? null : QuinielaSupport.ToDto(mine, round, now), pool, previous, canManage);
            }

            private async Task<QuinielaPreviousDto?> LoadPreviousAsync(string teamId, string userId, CancellationToken ct)
            {
                var last = (await db.QuinielaJornadas.AsNoTracking()
                        .Where(j => j.TeamId == teamId && j.Status == QuinielaJornadaStatus.Settled)
                        .ToListAsync(ct))
                    .OrderByDescending(j => j.SettledAt)
                    .FirstOrDefault();
                if (last is null)
                    return null;

                var roundNumber = await federationDb.RffmRounds.AsNoTracking()
                    .Where(r => r.Id == last.RffmRoundId).Select(r => r.Number).SingleOrDefaultAsync(ct);
                var mine = await db.QuinielaTickets.AsNoTracking()
                    .SingleOrDefaultAsync(t => t.JornadaId == last.Id && t.ApplicationUserId == userId, ct);

                return new QuinielaPreviousDto(
                    last.Id, roundNumber, last.SettledAt!.Value, last.CarryOut ?? 0m, mine?.Hits, mine?.Category?.Name, mine?.Prize);
            }
        }
    }
}
