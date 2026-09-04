using System.Collections.Generic;
using System.Linq;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notes
{
    /// <summary>
    /// Lists a team's convocation notes (free-text reminders shown on the "Ver convocatoria"
    /// popup / WhatsApp export), lazily seeding the two default notes the first time a team
    /// with zero notes is queried. Read access mirrors GetEventConvocations exactly.
    /// GET /api/teams/{teamId}/notes
    /// </summary>
    public class GetTeamNotes : IFeatureModule
    {
        public const string DefaultNoteText1 =
            "Traed las dos equipaciones (por si acaso) y las espinilleras — son obligatorias.";
        public const string DefaultNoteText2 =
            "Sin la equipación necesaria o sin espinilleras, el jugador no podrá jugar el partido.";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/teams/{teamId}/notes",
                    async (string teamId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(new GetTeamNotesQuery { TeamId = teamId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(GetTeamNotes))
                .WithTags("TeamNotes")
                .Produces<TeamNoteResponse[]>();
        }

        // ─── Query ────────────────────────────────────────────────────────────

        public record GetTeamNotesQuery : IQueryApp<TeamNoteResponse[]>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record TeamNoteResponse(string Id, string TeamId, string Text, int Order);

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<GetTeamNotesQuery, TeamNoteResponse[]>
        {
            public async ValueTask<TeamNoteResponse[]> Handle(GetTeamNotesQuery request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var notes = await db.TeamNotes
                    .Where(n => n.TeamId == request.TeamId)
                    .OrderBy(n => n.Order)
                    .ToListAsync(cancellationToken);

                if (notes.Count == 0)
                {
                    notes = new List<TeamNote>
                    {
                        TeamNote.Create(request.TeamId, DefaultNoteText1, 1),
                        TeamNote.Create(request.TeamId, DefaultNoteText2, 2),
                    };
                    db.TeamNotes.AddRange(notes);
                    await db.SaveChangesAsync(cancellationToken);
                }

                return notes
                    .OrderBy(n => n.Order)
                    .Select(n => new TeamNoteResponse(n.Id, n.TeamId, n.Text, n.Order))
                    .ToArray();
            }
        }
    }
}
