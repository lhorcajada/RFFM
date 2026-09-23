using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using RFFM.Api.Common;
using RFFM.Api.Domain.Entities.Audit;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;

namespace RFFM.Api.Features.Audit
{
    /// <summary>
    /// Frontend calls this when a user enters an audited section (coarse-grained: once per
    /// section visit, not on every internal route change). PageIdentifier is the same string
    /// space as PagePermission.PageIdentifier. See openspec change user-activity-audit-log.
    /// </summary>
    public class RecordPageAccess : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/audit-log/page-access",
                    async (RecordPageAccessCommand command, IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        await mediator.Send(command, cancellationToken);
                        return Results.Ok();
                    })
                .WithName(nameof(RecordPageAccess))
                .WithTags("Audit")
                .RequireAuthorization()
                .Produces(StatusCodes.Status200OK)
                .Produces(StatusCodes.Status400BadRequest);
        }

        public class RecordPageAccessCommand : RFFM.Api.Common.ICommand
        {
            public string PageIdentifier { get; set; } = null!;
            public string? ClubId { get; set; }
            public string? TeamId { get; set; }
        }

        public class Handler : IRequestHandler<RecordPageAccessCommand, Mediator.Unit>
        {
            private readonly AppDbContext _db;
            private readonly IAuditLogger _auditLogger;

            public Handler(AppDbContext db, IAuditLogger auditLogger)
            {
                _db = db;
                _auditLogger = auditLogger;
            }

            public async ValueTask<Mediator.Unit> Handle(RecordPageAccessCommand request, CancellationToken cancellationToken = default)
            {
                await _auditLogger.LogAsync(
                    AuditEventType.PageAccess, request.PageIdentifier, "Success",
                    clubId: request.ClubId, teamId: request.TeamId, cancellationToken: cancellationToken);

                await _db.SaveChangesAsync(cancellationToken);
                return Mediator.Unit.Value;
            }
        }

        public class RecordPageAccessValidator : AbstractValidator<RecordPageAccessCommand>
        {
            public RecordPageAccessValidator()
            {
                RuleFor(r => r.PageIdentifier).NotEmpty().MaximumLength(100);
            }
        }
    }
}
