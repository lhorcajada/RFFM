using FluentValidation;
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
    /// Edits a team convocation note's text in place, preserving its creation-order position.
    /// Coach role only.
    /// PUT /api/teams/{teamId}/notes/{noteId}
    /// </summary>
    public class UpdateTeamNote : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/teams/{teamId}/notes/{noteId}",
                    async (string teamId, string noteId, UpdateTeamNoteCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId, NoteId = noteId }, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(UpdateTeamNote))
                .WithTags("TeamNotes")
                .Produces<GetTeamNotes.TeamNoteResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" });
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record UpdateTeamNoteCommand : IRequest<GetTeamNotes.TeamNoteResponse>
        {
            public string TeamId { get; set; } = null!;
            public string NoteId { get; set; } = null!;
            public string Text { get; set; } = null!;
        }

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<UpdateTeamNoteCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Text).NotEmpty().MaximumLength(500);
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<UpdateTeamNoteCommand, GetTeamNotes.TeamNoteResponse>
        {
            public async ValueTask<GetTeamNotes.TeamNoteResponse> Handle(UpdateTeamNoteCommand request, CancellationToken cancellationToken)
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

                note.UpdateText(request.Text);
                await db.SaveChangesAsync(cancellationToken);

                return new GetTeamNotes.TeamNoteResponse(note.Id, note.TeamId, note.Text, note.Order);
            }
        }
    }
}
