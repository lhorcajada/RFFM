using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    /// <summary>
    /// One-off cleanup for calendars polluted by the (now-fixed) GET /calendar bug: league
    /// fixtures resolved against a stale hardcoded competition/group ended up filed under the
    /// current team even though they belonged to a different team/season. Deletes only League
    /// (EventTypeId = MatchEventTypeId) SportEvents for one team dated before a given cutoff —
    /// Friendlies, Tournaments, Trainings, and anything on/after the cutoff are untouched.
    /// </summary>
    public class DeleteLeagueMatchesBefore : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("api/sport-events/{teamId}/league-matches",
                    async (string teamId, [FromQuery] DateTime before, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new DeleteLeagueMatchesBeforeCommand(teamId, before);
                        var result = await mediator.Send(command, cancellationToken);
                        return Results.Ok(result);
                    })
                .WithName(nameof(DeleteLeagueMatchesBefore))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<DeleteLeagueMatchesBeforeResult>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Administrator,Coach,ClubDirector,ClubMember" });
        }
    }

    public record DeleteLeagueMatchesBeforeCommand(string TeamId, DateTime Before) : IRequest<DeleteLeagueMatchesBeforeResult>;

    public record DeleteLeagueMatchesBeforeResult(int Deleted);

    public class DeleteLeagueMatchesBeforeHandler : IRequestHandler<DeleteLeagueMatchesBeforeCommand, DeleteLeagueMatchesBeforeResult>
    {
        private readonly AppDbContext _db;

        public DeleteLeagueMatchesBeforeHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<DeleteLeagueMatchesBeforeResult> Handle(DeleteLeagueMatchesBeforeCommand request, CancellationToken cancellationToken)
        {
            var beforeUtc = DateTime.SpecifyKind(request.Before, DateTimeKind.Utc);

            var toDelete = await _db.SportEvents
                .Where(e => e.TeamId == request.TeamId
                    && e.EventTypeId == SportEventsConstants.MatchEventTypeId
                    && e.EveDateTime < beforeUtc)
                .ToListAsync(cancellationToken);

            _db.SportEvents.RemoveRange(toDelete);
            await _db.SaveChangesAsync(cancellationToken);

            return new DeleteLeagueMatchesBeforeResult(toDelete.Count);
        }
    }

    public class DeleteLeagueMatchesBeforeValidator : AbstractValidator<DeleteLeagueMatchesBeforeCommand>
    {
        public DeleteLeagueMatchesBeforeValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Before).NotEqual(default(DateTime));
        }
    }
}
