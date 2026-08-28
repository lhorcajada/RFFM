using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    /// <summary>
    /// Lets an already-authenticated Coach/Directive who has club-level UserClub access (but no
    /// team context yet) enter a team code and land on that team, without creating a UserTeam
    /// row -- club-level access already grants edit rights to every team in the club (see
    /// TeamEditAuthorization.CanEditAsync). See
    /// openspec/changes/coach-club-code-team-entry/design.md Decisions 1-3.
    /// </summary>
    public class EnterClubTeamAsCoach : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/invitations/team/enter-as-coach",
                    async (Request request, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new Command { Code = request.Code };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(EnterClubTeamAsCoach))
                .WithTags("InvitationFeature")
                .RequireAuthorization()
                .Produces<Response>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }

        public record Request(string Code);

        public record Command : IRequest<IResult>
        {
            public string Code { get; set; } = string.Empty;
        }

        public record Response(string TeamId, string TeamName);

        public class Handler : IRequestHandler<Command, IResult>
        {
            private readonly AppDbContext _db;
            private readonly ICurrentUserService _currentUser;

            public Handler(AppDbContext db, ICurrentUserService currentUser)
            {
                _db = db;
                _currentUser = currentUser;
            }

            public async ValueTask<IResult> Handle(Command request, CancellationToken cancellationToken = default)
            {
                var userId = _currentUser.UserId;
                if (string.IsNullOrEmpty(userId))
                {
                    return Results.Unauthorized();
                }

                var normalizedCode = request.Code.Trim().ToUpperInvariant();
                var team = await _db.Teams
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.JoinCode == normalizedCode, cancellationToken);

                if (team is null)
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status404NotFound,
                        title: "Código no válido",
                        detail: "No existe ningún equipo con ese código.");
                }

                var hasClubAccess = await _db.UserClubs
                    .AsNoTracking()
                    .AnyAsync(uc => uc.ApplicationUserId == userId && uc.ClubId == team.ClubId &&
                        (uc.RoleId == Membership.Coach.Id || uc.RoleId == Membership.Directive.Id),
                        cancellationToken);

                if (!hasClubAccess)
                {
                    return Results.Problem(
                        statusCode: StatusCodes.Status403Forbidden,
                        title: "Acceso denegado",
                        detail: "Este código pertenece a un equipo de otro club.");
                }

                var config = await _db.Set<ConfigurationCoach>()
                    .FirstOrDefaultAsync(c => c.CoachId == userId, cancellationToken);

                if (config is null)
                {
                    _db.Add(new ConfigurationCoach
                    {
                        CoachId = userId,
                        PreferredClubId = team.ClubId,
                        PreferredTeamId = team.Id
                    });
                }
                else
                {
                    config.PreferredClubId = team.ClubId;
                    config.PreferredTeamId = team.Id;
                }

                await _db.SaveChangesAsync(cancellationToken);

                return Results.Ok(new Response(team.Id, team.Name));
            }
        }

        public class Validator : AbstractValidator<Command>
        {
            public Validator()
            {
                RuleFor(r => r.Code)
                    .NotEmpty()
                    .Length(ValidationConstants.TeamJoinCodeLength)
                    .Matches("^[A-Za-z0-9]{8}$")
                    .WithMessage("El código de equipo debe tener exactamente 8 caracteres alfanuméricos.");
            }
        }
    }
}
