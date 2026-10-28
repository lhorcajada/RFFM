using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Audit
{
    /// <summary>
    /// DELETE /api/audit-log — elimina de forma permanente una lista (1-100) de eventos de auditoría.
    /// Solo Federation/Administrator. Los ids inexistentes se ignoran; devuelve cuántos se borraron.
    /// </summary>
    public class DeleteAuditLogEntries : IFeatureModule
    {
        private const int MaxIds = 100;

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/audit-log",
                    async ([FromBody] DeleteAuditLogEntriesRequest request, IMediator mediator, CancellationToken ct) =>
                    {
                        var response = await mediator.Send(new DeleteAuditLogEntriesCommand(request.Ids), ct);
                        return Results.Ok(response);
                    })
                .WithName(nameof(DeleteAuditLogEntries))
                .WithTags("Audit")
                .RequireAuthorization(new AuthorizeAttribute { Roles = "Federation,Administrator" })
                .Produces<DeleteAuditLogEntriesResponse>()
                .ProducesValidationProblem();
        }

        public record DeleteAuditLogEntriesRequest(string[] Ids);

        public record DeleteAuditLogEntriesCommand(string[] Ids) : RFFM.Api.Common.ICommand<DeleteAuditLogEntriesResponse>;

        public record DeleteAuditLogEntriesResponse(int Deleted);

        public class Validator : AbstractValidator<DeleteAuditLogEntriesCommand>
        {
            public Validator()
            {
                RuleFor(c => c.Ids)
                    .NotNull()
                    .Must(ids => ids.Length is >= 1 and <= MaxIds)
                    .WithMessage($"Debe indicarse entre 1 y {MaxIds} eventos.")
                    .When(c => c.Ids is not null);

                RuleForEach(c => c.Ids)
                    .Must(id => !string.IsNullOrWhiteSpace(id))
                    .WithMessage("Los ids de evento no pueden estar vacíos.")
                    .When(c => c.Ids is not null);

                RuleFor(c => c.Ids)
                    .Must(ids => ids.Distinct(StringComparer.Ordinal).Count() == ids.Length)
                    .WithMessage("Los ids de evento no pueden repetirse.")
                    .When(c => c.Ids is not null);
            }
        }

        public class Handler(AppDbContext db) : IRequestHandler<DeleteAuditLogEntriesCommand, DeleteAuditLogEntriesResponse>
        {
            public async ValueTask<DeleteAuditLogEntriesResponse> Handle(
                DeleteAuditLogEntriesCommand request,
                CancellationToken cancellationToken = default)
            {
                var deleted = await db.UserActivityLogs
                    .Where(a => request.Ids.Contains(a.Id))
                    .ExecuteDeleteAsync(cancellationToken);

                return new DeleteAuditLogEntriesResponse(deleted);
            }
        }
    }
}
