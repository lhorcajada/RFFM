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
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using System.Security.Claims;

namespace RFFM.Api.Features.Coaches.ClubJoinRequests.Commands
{
    public class CancelClubJoinRequest : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("api/club-join-requests/{requestId}/cancel",
                    async (string requestId, IMediator mediator, HttpContext httpContext, CancellationToken cancellationToken) =>
                    {
                        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                                     ?? httpContext.User.FindFirst("sub")?.Value;
                        if (string.IsNullOrEmpty(userId)) return Results.Unauthorized();

                        return await mediator.Send(new CancelClubJoinRequestCommand
                        {
                            RequestId = requestId,
                            CallerUserId = userId
                        }, cancellationToken);
                    })
                .WithName(nameof(CancelClubJoinRequest))
                .WithTags("ClubJoinRequestsFeature")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces<ProblemDetails>(StatusCodes.Status403Forbidden)
                .Produces<ProblemDetails>(StatusCodes.Status404NotFound)
                .Produces<ProblemDetails>(StatusCodes.Status409Conflict);
        }
    }

    public class CancelClubJoinRequestCommand : IRequest<IResult>, IRequireFeaturePermission
    {
        public string RequestId { get; set; } = string.Empty;
        public string CallerUserId { get; set; } = string.Empty;

        public string FeatureRoute => CoachFeatureRoutes.ClubRegistrations;
        public string RequiredPermission => "ReadWrite";
    }

    public class CancelClubJoinRequestHandler : IRequestHandler<CancelClubJoinRequestCommand, IResult>
    {
        private readonly AppDbContext _db;

        public CancelClubJoinRequestHandler(AppDbContext db)
        {
            _db = db;
        }

        public async ValueTask<IResult> Handle(CancelClubJoinRequestCommand request, CancellationToken cancellationToken)
        {
            var joinRequest = await _db.ClubJoinRequests
                .FirstOrDefaultAsync(r => r.Id == request.RequestId, cancellationToken);
            if (joinRequest is null)
            {
                return Results.NotFound(new ProblemDetails
                {
                    Title = "Solicitud no encontrada",
                    Detail = "No existe la solicitud indicada.",
                    Extensions = { ["code"] = ErrorCodes.ClubJoinRequestNotFound }
                });
            }

            if (joinRequest.ApplicationUserId != request.CallerUserId)
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "Acción no permitida",
                    detail: "Solo el solicitante puede cancelar esta solicitud.",
                    extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.ClubJoinRequestCancelForbidden });
            }

            if (joinRequest.Status != ClubJoinRequestStatus.Pending)
            {
                return Results.Conflict(new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "Solicitud ya decidida",
                    Detail = "La solicitud ya fue procesada.",
                    Extensions = { ["code"] = ErrorCodes.ClubJoinRequestAlreadyDecided }
                });
            }

            // A single AppDbContext.SaveChangesAsync() call is already atomic on its own (EF Core
            // wraps it in an implicit transaction); wrapping it in a System.Transactions.TransactionScope
            // added no real atomicity here and is incompatible with AppDbContext's
            // EnableRetryOnFailure execution strategy (EF Core throws "The configured execution
            // strategy ... does not support user-initiated transactions" as soon as any command runs
            // under an ambient TransactionScope). See CreateUser.cs for the fuller explanation.
            joinRequest.Cancel();
            await _db.SaveChangesAsync(cancellationToken);

            return Results.Ok();
        }
    }
}
