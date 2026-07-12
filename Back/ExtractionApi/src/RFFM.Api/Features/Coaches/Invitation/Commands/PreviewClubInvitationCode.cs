using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Invitation.Commands
{
    public class PreviewClubInvitationCode : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/invitations/club/preview",
                    async (PreviewClubInvitationRequest request, Mediator.IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var command = new PreviewClubInvitationCommand
                        {
                            Code = request.Code,
                            MembershipKind = request.MembershipKind
                        };
                        return await mediator.Send(command, cancellationToken);
                    })
                .WithName(nameof(PreviewClubInvitationCode))
                .WithTags("InvitationFeature")
                .AllowAnonymous()
                .Produces<PreviewClubInvitationResponse>(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status400BadRequest)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound);
        }
    }

    public class PreviewClubInvitationRequest
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class PreviewClubInvitationCommand : IRequest<IResult>
    {
        public string Code { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class PreviewClubInvitationResponse
    {
        public string ClubId { get; set; } = string.Empty;
        public string ClubName { get; set; } = string.Empty;
        public string MembershipKind { get; set; } = string.Empty;
    }

    public class PreviewClubInvitationHandler : IRequestHandler<PreviewClubInvitationCommand, IResult>
    {
        private readonly AppDbContext _db;

        public PreviewClubInvitationHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<IResult> Handle(PreviewClubInvitationCommand request, CancellationToken cancellationToken)
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

            var validation = await ClubInvitationValidation.Validate(_db, request.Code, membership, cancellationToken);
            if (!validation.Success)
            {
                return Results.Problem(
                    statusCode: validation.StatusCode,
                    title: validation.Title,
                    detail: validation.Detail,
                    extensions: new Dictionary<string, object?> { ["code"] = validation.ErrorCode });
            }

            return Results.Ok(new PreviewClubInvitationResponse
            {
                ClubId = validation.Club!.Id,
                ClubName = validation.Club.Name,
                MembershipKind = membership.Key
            });
        }
    }

    public class PreviewClubInvitationValidator : AbstractValidator<PreviewClubInvitationCommand>
    {
        public PreviewClubInvitationValidator()
        {
            RuleFor(r => r.Code).NotEmpty();
            RuleFor(r => r.MembershipKind).NotEmpty();
        }
    }
}
