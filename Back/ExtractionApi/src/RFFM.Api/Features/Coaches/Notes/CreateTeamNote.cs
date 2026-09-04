using System.Linq;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Notes
{
    /// <summary>
    /// Creates a new convocation note for a team, appended after all existing notes
    /// (creation order preserved). Coach role only.
    /// POST /api/teams/{teamId}/notes
    /// </summary>
    public class CreateTeamNote : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/teams/{teamId}/notes",
                    async (string teamId, CreateTeamNoteCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var result = await mediator.Send(command with { TeamId = teamId }, cancellationToken);
                        return Results.Created($"/api/teams/{teamId}/notes/{result.Id}", result);
                    })
                .WithName(nameof(CreateTeamNote))
                .WithTags("TeamNotes")
                .Produces<GetTeamNotes.TeamNoteResponse>(StatusCodes.Status201Created)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Coach" });
        }

        // ─── Command ──────────────────────────────────────────────────────────

        public record CreateTeamNoteCommand : IRequest<GetTeamNotes.TeamNoteResponse>
        {
            public string TeamId { get; set; } = null!;
            public string Text { get; set; } = null!;
        }

        // ─── Validator ────────────────────────────────────────────────────────

        public class Validator : AbstractValidator<CreateTeamNoteCommand>
        {
            public Validator()
            {
                RuleFor(x => x.Text).NotEmpty().MaximumLength(500);
            }
        }

        // ─── Handler ──────────────────────────────────────────────────────────

        public class Handler(AppDbContext db) : IRequestHandler<CreateTeamNoteCommand, GetTeamNotes.TeamNoteResponse>
        {
            public async ValueTask<GetTeamNotes.TeamNoteResponse> Handle(CreateTeamNoteCommand request, CancellationToken cancellationToken)
            {
                var team = await db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == request.TeamId, cancellationToken);

                if (team == null)
                    throw new NotFoundException("Equipo no encontrado", "TeamNotFound");

                var existingOrders = await db.TeamNotes
                    .Where(n => n.TeamId == request.TeamId)
                    .Select(n => n.Order)
                    .ToListAsync(cancellationToken);

                var nextOrder = existingOrders.Count == 0 ? 1 : existingOrders.Max() + 1;

                var note = TeamNote.Create(request.TeamId, request.Text, nextOrder);
                db.TeamNotes.Add(note);
                await db.SaveChangesAsync(cancellationToken);

                return new GetTeamNotes.TeamNoteResponse(note.Id, note.TeamId, note.Text, note.Order);
            }
        }
    }
}
