using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.PlayerDocuments
{
    public class PlayerDocumentTypesQueries : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/catalog/document-types",
                    async (IMediator mediator, CancellationToken ct) =>
                        await mediator.Send(new DocumentTypesQuery(), ct))
                .WithName(nameof(PlayerDocumentTypesQueries))
                .RequireAuthorization();
        }

        public record DocumentTypesQuery : IQueryApp<DocumentTypeResponse[]>;

        public record DocumentTypeResponse(string Id, string Name, string? Description, bool IsActive);

        public class Handler(AppDbContext db) : IRequestHandler<DocumentTypesQuery, DocumentTypeResponse[]>
        {
            public async ValueTask<DocumentTypeResponse[]> Handle(DocumentTypesQuery request, CancellationToken cancellationToken)
            {
                return await db.DocumentTypes
                    .AsNoTracking()
                    .Where(d => d.IsActive)
                    .Select(d => new DocumentTypeResponse(d.Id, d.Name, d.Description, d.IsActive))
                    .ToArrayAsync(cancellationToken);
            }
        }
    }
}
