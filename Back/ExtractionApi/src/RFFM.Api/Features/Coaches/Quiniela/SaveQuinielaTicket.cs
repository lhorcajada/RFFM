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
    /// Guarda (o reemplaza) el boleto del usuario: un signo por partido válido y los goles del Pleno.
    /// PUT /api/teams/{teamId}/quiniela/{jornadaId}/ticket
    /// See openspec/changes/quiniela-team-pool/design.md → D3, D7.
    /// </summary>
    public class SaveQuinielaTicket : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut($"{QuinielaConstants.BaseRoute}/{{jornadaId}}/ticket",
                    async (string teamId, string jornadaId, Body body, IMediator mediator, CancellationToken ct) =>
                    {
                        var command = new Command { TeamId = teamId, JornadaId = jornadaId, Picks = body.Picks ?? [], PlenoHome = body.PlenoHome, PlenoAway = body.PlenoAway };
                        return Results.Ok(await mediator.Send(command, ct));
                    })
                .WithName(nameof(SaveQuinielaTicket))
                .WithTags(QuinielaConstants.Tag)
                .RequireAuthorization()
                .Produces<QuinielaTicketDto>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status403Forbidden)
                .ProducesProblem(StatusCodes.Status404NotFound);
        }

        public record PickRequest(string RecordCode, string Sign);

        public record Body(List<PickRequest>? Picks, int PlenoHome, int PlenoAway);

        public record Command : RFFM.Api.Common.ICommand<QuinielaTicketDto>
        {
            public string TeamId { get; init; } = null!;
            public string JornadaId { get; init; } = null!;
            public List<PickRequest> Picks { get; init; } = [];
            public int PlenoHome { get; init; }
            public int PlenoAway { get; init; }
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(c => c.TeamId).NotEmpty();
                RuleFor(c => c.JornadaId).NotEmpty();
                RuleFor(c => c.Picks).NotEmpty();
                RuleForEach(c => c.Picks).ChildRules(pick =>
                {
                    pick.RuleFor(p => p.RecordCode).NotEmpty();
                    pick.RuleFor(p => p.Sign).Must(sign => QuinielaSign.TryFromName(sign, out _))
                        .WithMessage("El signo debe ser 1, X o 2.");
                });
                RuleFor(c => c.Picks)
                    .Must(picks => picks.Select(p => p.RecordCode).Distinct().Count() == picks.Count)
                    .WithMessage("No puede haber dos pronósticos para el mismo partido.");
                RuleFor(c => c.PlenoHome).InclusiveBetween(0, QuinielaTicket.Rules.MaxPlenoGoals);
                RuleFor(c => c.PlenoAway).InclusiveBetween(0, QuinielaTicket.Rules.MaxPlenoGoals);
            }
        }

        public class Handler(AppDbContext db, FederationDbContext federationDb, ICurrentUserService currentUser, TimeProvider timeProvider)
            : IRequestHandler<Command, QuinielaTicketDto>
        {
            public async ValueTask<QuinielaTicketDto> Handle(Command request, CancellationToken cancellationToken)
            {
                await QuinielaSupport.RequireRoleAsync(db, currentUser, request.TeamId, QuinielaSupport.ParticipantRoles, cancellationToken);

                var jornada = await QuinielaSupport.LoadJornadaAsync(db, request.TeamId, request.JornadaId, cancellationToken);
                var round = await QuinielaSupport.LoadRoundAsync(federationDb, jornada.RffmRoundId, cancellationToken);
                var now = timeProvider.GetUtcNow().UtcDateTime;
                jornada.EnsurePicksOpen(round.FirstValidKickoffUtc, now);

                var allCodes = round.Matches.Select(m => m.RecordCode).ToHashSet();
                var validCodes = round.ValidMatches.Select(m => m.RecordCode).ToHashSet();
                var unknownMatch = request.Picks.Any(p => !allCodes.Contains(p.RecordCode));
                var picks = request.Picks.Where(p => validCodes.Contains(p.RecordCode)).ToList();
                var missingPick = validCodes.Any(code => picks.All(p => p.RecordCode != code));
                if (unknownMatch || missingPick)
                    throw new DomainException("Quiniela",
                        "El boleto debe tener un pronóstico para cada partido válido de la jornada.", ErrorCodes.QuinielaInvalidTicket);

                var domainPicks = picks.Select(p => new QuinielaPick(p.RecordCode, QuinielaSign.FromName(p.Sign))).ToList();
                var userId = currentUser.UserId!;
                var ticket = await db.QuinielaTickets.SingleOrDefaultAsync(
                    t => t.JornadaId == jornada.Id && t.ApplicationUserId == userId, cancellationToken);
                if (ticket is null)
                {
                    ticket = QuinielaTicket.Create(jornada.Id, userId, domainPicks, request.PlenoHome, request.PlenoAway);
                    db.QuinielaTickets.Add(ticket);
                }
                else
                {
                    ticket.ReplacePicks(domainPicks, request.PlenoHome, request.PlenoAway);
                }

                await db.SaveChangesAsync(cancellationToken);
                return QuinielaSupport.ToDto(ticket, round, now);
            }
        }
    }
}
