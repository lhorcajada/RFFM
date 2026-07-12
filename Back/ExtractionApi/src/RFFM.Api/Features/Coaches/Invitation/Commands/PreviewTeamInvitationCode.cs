using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    public class PreviewTeamInvitationCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/invitations/team/preview",
                    async (PreviewTeamInvitationRequest request, Mediator.IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new PreviewTeamInvitationCommand
                        {
                            Code = request.Code,
                            MembershipKind = request.MembershipKind
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(PreviewTeamInvitationCode))
                .WithTags("InvitationFeature")
                .AllowAnonymous()
                .Produces<PreviewTeamInvitationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class PreviewTeamInvitationRequest
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class PreviewTeamInvitationCommand : IRequest<IResult>
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class TeamRosterPlayerDto
    {
        public string TeamPlayerId { get; set; } = string.Empty;
        public string PlayerId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? LastName { get; set; }
        public string? UrlPhoto { get; set; }
        public int? Dorsal { get; set; }
        public bool AlreadyLinked { get; set; }
    }

    public class PreviewTeamInvitationResponse
    {
        public string TeamId { get; set; } = string.Empty;
        public string TeamName { get; set; } = string.Empty;
        public string ClubId { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
        public TeamRosterPlayerDto[] Players { get; set; } = Array.Empty<TeamRosterPlayerDto>();
    }

    public class PreviewTeamInvitationHandler : IRequestHandler<PreviewTeamInvitationCommand, IResult>
    {
        private readonly AppDbContext _db;

        public PreviewTeamInvitationHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<IResult> Handle(PreviewTeamInvitationCommand request, CancellationToken cancellationToken)
        {
            var membership = MembershipIdentityRoles.FromKey(request.MembershipKind);
            if (membership is null)
            {
                return Results.BadRequest(new ProblemDetails
                {
                    Title = "Membership no permitida",
                    Detail = "Rol de membership desconocido."
                });
            }

            var validation = await TeamInvitationValidation.Validate(_db, request.Code, membership, cancellationToken);
            if (!validation.Success)
            {
                return Results.Problem(
                    statusCode: validation.StatusCode,
                    title: validation.Title,
                    detail: validation.Detail,
                    extensions: new Dictionary<string, object?> { ["code"] = validation.ErrorCode });
            }

            var team = validation.Team!;
            var rosterMembershipId = membership.Key == Membership.Player.Key ? Membership.Player.Id : (int?)null;
            var players = await TeamRosterQueries.GetRoster(_db, team.Id, rosterMembershipId, cancellationToken);

            return Results.Ok(new PreviewTeamInvitationResponse
            {
                TeamId = team.Id,
                TeamName = team.Name,
                ClubId = team.ClubId,
                MembershipKind = membership.Key,
                Players = players.Select(p => new TeamRosterPlayerDto
                {
                    TeamPlayerId = p.TeamPlayerId,
                    PlayerId = p.PlayerId,
                    Name = p.Name,
                    LastName = p.LastName,
                    UrlPhoto = p.UrlPhoto,
                    Dorsal = p.Dorsal,
                    AlreadyLinked = p.AlreadyLinked
                }).ToArray()
            });
        }
    }

    public class PreviewTeamInvitationValidator : AbstractValidator<PreviewTeamInvitationCommand>
    {
        public PreviewTeamInvitationValidator()
        {
            RuleFor(r => r.Code).NotEmpty();
            RuleFor(r => r.MembershipKind).NotEmpty();
        }
    }
}
