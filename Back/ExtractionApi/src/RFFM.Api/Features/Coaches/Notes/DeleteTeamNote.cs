using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notes
{
    /// <summary>
    /// Permanently deletes a team convocation note. Coach role only. Deleting a note never
    /// renumbers the remaining notes' Order — only relative order matters for display.
    /// DELETE /api/teams/{teamId}/notes/{noteId}
    /// </summary>
    public class DeleteTeamNote : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/teams/{teamId}/notes/{noteId}",
                    async (string teamId, string noteId, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(new DeleteTeamNoteCommand { TeamId = teamId, NoteId = noteId }, cancellationToken);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteTeamNote))
                .WithTags("TeamNotes")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" });
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record DeleteTeamNoteCommand : IRequest
        {
            public string TeamId { get; set; } = null!;
            public string NoteId { get; set; } = null!;
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<DeleteTeamNoteCommand, Unit>
        {
            public async ValueTask<Unit> Handle(DeleteTeamNoteCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var note = await db.TeamNotes
                    .FirstOrDefaultAsync(n => n.Id == request.NoteId && n.TeamId == request.TeamId, cancellationToken);

                if (note == null)
                    throw new NotFoundException("Nota no encontrada", "TeamNoteNotFound");

                db.TeamNotes.Remove(note);
                await db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
