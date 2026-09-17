using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class ReviewPlayerDocument : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPatch("/api/catalog/teamplayer/{teamPlayerId}/documents/{documentTypeId}/review",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string teamPlayerId, string documentTypeId, ReviewPlayerDocumentRequest request,
                        IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(new ReviewPlayerDocumentCommand(teamPlayerId, documentTypeId, request.Approve, request.Note), ct))
                .WithName(nameof(ReviewPlayerDocument))
                .RequireAuthorization();
        }

        public record ReviewPlayerDocumentRequest(bool Approve, string? Note);

        public record ReviewPlayerDocumentCommand(string TeamPlayerId, string DocumentTypeId, bool Approve, string? Note)
            : RFFM.Api.Common.ICommand<GetPlayerDocuments.PlayerDocumentResponse>;

        public class Handler(AppDbContext db, ICurrentUserService currentUser)
            : IRequestHandler<ReviewPlayerDocumentCommand, GetPlayerDocuments.PlayerDocumentResponse>
        {
            public async ValueTask<GetPlayerDocuments.PlayerDocumentResponse> Handle(
                ReviewPlayerDocumentCommand request, CancellationToken cancellationToken)
            {
                var doc = await db.PlayerDocuments
                    .FirstOrDefaultAsync(d => d.TeamPlayerId == request.TeamPlayerId && d.DocumentTypeId == request.DocumentTypeId, cancellationToken);

                if (doc is null)
                    throw new NotFoundException("PlayerDocument", ErrorCodes.PlayerDocumentNotFound);

                try
                {
                    if (request.Approve) doc.Approve(currentUser.UserId!, request.Note);
                    else doc.Reject(currentUser.UserId!, request.Note);
                }
                catch (InvalidOperationException)
                {
                    throw new ConflictException("PlayerDocument", ErrorCodes.PlayerDocumentNotDelivered);
                }

                await db.SaveChangesAsync(cancellationToken);

                var documentType = await db.DocumentTypes.AsNoTracking().FirstAsync(d => d.Id == request.DocumentTypeId, cancellationToken);

                return new GetPlayerDocuments.PlayerDocumentResponse(
                    doc.DocumentTypeId, documentType.Name, doc.TeamPlayerId, doc.Status.Name,
                    doc.FileName, doc.StorageUrl, doc.ContentType, doc.UploadedAt, doc.UploadedOnBehalf,
                    doc.ReviewedAt, doc.ReviewNote);
            }
        }
    }
}
