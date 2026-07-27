using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Mobile.Attendance.Commands
{
    public class ConfirmAttendance : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/mobile/events/{eventId}/attendance",
                    async (string eventId, ConfirmAttendanceRequest body, IMediator mediator, CancellationToken ct) =>
                    {
                        var command = new ConfirmAttendanceCommand
                        {
                            SportEventId = eventId,
                            TeamId = body.TeamId,
                            TeamPlayerId = body.TeamPlayerId,
                            Status = body.Status
                        };
                        await mediator.Send(command, ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(ConfirmAttendance))
                .WithTags("Attendance")
                .Produces(StatusCodes.Status204NoContent)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden);
        }

        public record ConfirmAttendanceRequest(string TeamId, string TeamPlayerId, string Status);

        public record ConfirmAttendanceCommand : IRequest<Unit>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string SportEventId { get; set; } = null!;
            public string TeamId { get; set; } = null!;
            public string TeamPlayerId { get; set; } = null!;
            public string Status { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.AttendanceConfirmation;
            public string RequiredPermission => "Write";
        }

        public class Validator : AbstractValidator<ConfirmAttendanceCommand>
        {
            public Validator()
            {
                RuleFor(x => x.TeamPlayerId).NotEmpty().WithMessage("Team player ID is required");
                RuleFor(x => x.Status)
                    .Must(s => AttendanceStatus.List().Any(a => a.Name == s))
                    .WithMessage("Invalid attendance status");
            }
        }

        public class Handler(AppDbContext db, ICurrentUserService currentUser) : IRequestHandler<ConfirmAttendanceCommand, Unit>
        {
            public async ValueTask<Unit> Handle(ConfirmAttendanceCommand request, CancellationToken cancellationToken)
            {
                // Verify the player belongs to the user (Player or FamilyMember linked player)
                var isOwnPlayer = await db.Set<UserTeam>()
                    .AsNoTracking()
                    .AnyAsync(ut =>
                        ut.ApplicationUserId == currentUser.UserId &&
                        ut.TeamId == request.TeamId &&
                        (ut.LinkedTeamPlayerId == request.TeamPlayerId),
                        cancellationToken);

                if (!isOwnPlayer)
                    throw new ForbiddenAccessException("You cannot confirm attendance for a player that is not yours or your linked family member's.");

                // Upsert EventAttendanceConfirmation
                var status = AttendanceStatus.FromName(request.Status);
                var existingConfirmation = await db.Set<EventAttendanceConfirmation>()
                    .FirstOrDefaultAsync(eac =>
                        eac.SportEventId == request.SportEventId &&
                        eac.TeamPlayerId == request.TeamPlayerId,
                        cancellationToken);

                if (existingConfirmation != null)
                {
                    existingConfirmation.UpdateStatus(status.Id);
                }
                else
                {
                    var newConfirmation = new EventAttendanceConfirmation(
                        request.SportEventId,
                        request.TeamPlayerId,
                        currentUser.UserId,
                        status.Id
                    );
                    db.Set<EventAttendanceConfirmation>().Add(newConfirmation);
                }

                await db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
