using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    public class ValidateInvitationCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/invitation/validate",
                    async (ValidateInvitationRequest request, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.Claims.FirstOrDefault(c =>
                            c.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value;

                        if (string.IsNullOrEmpty(userId))
                        {
                            return Results.Unauthorized();
                        }
                        var command = new ValidateInvitationCodeCommand
                        {
                            Code = request.Code,
                            RoleId = request.RoleId,
                            UserId = userId 
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(ValidateInvitationCode))
                .WithTags("InvitationFeature")
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class ValidateInvitationRequest
    {
        public string Code { get; set; } = string.Empty;
        public int RoleId { get; set; } = 0;

    }
    public class ValidateInvitationCodeCommand : IRequest<IResult>
    {
        public string Code { get; set; } = string.Empty;
        public int RoleId { get; set; } = 0;
        public string UserId { get; set; } = string.Empty;
    }

    public class ValidateInvitationCodeHandler : IRequestHandler<ValidateInvitationCodeCommand, IResult>
    {
        private readonly AppDbContext _db;

        public ValidateInvitationCodeHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<IResult> Handle(ValidateInvitationCodeCommand request, CancellationToken cancellationToken)
        {
            var club = await _db.Clubs
                .Include(c => c.UserClubs)
                .FirstOrDefaultAsync(c => c.InvitationCode == request.Code, cancellationToken);

            if (club == null)
            {
                return Results.NotFound(new { Message = "El código de invitación no es válido." });
            }

            var userClubExists = await _db.UserClubs.AnyAsync(
                uc => uc.ApplicationUserId == request.UserId && uc.ClubId == club.Id,
                cancellationToken);

            if (userClubExists)
            {
                return Results.BadRequest(new { Message = "El usuario ya está asociado a este club." });
            }

            _db.UserClubs.Add(new UserClub(
                request.UserId,
                club.Id,
                request.RoleId
            ));

            await _db.SaveChangesAsync(cancellationToken);

            return Results.Ok(new { Message = "El usuario ha sido asignado al club correctamente." });
        }
    }
}
