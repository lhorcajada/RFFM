using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    /// <summary>
    /// Deletes a single family member/contact from a TeamPlayer.
    /// DELETE /api/catalog/teamplayer/{id}/family-members/{familyMemberId}
    /// See CreateFamilyMember.cs for the rationale on using Mediator ICommand here (rather than
    /// the inline Minimal API handler pattern used by SetPlayerSanction/SetPlayerInjury) and on
    /// [Authorize(Roles = ...)] instead of IRequireFeaturePermission.
    /// </summary>
    public class DeleteFamilyMember : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapDelete("/api/catalog/teamplayer/{id}/family-members/{familyMemberId}",
                    [Authorize(Roles = "Coach,Administrator")]
                    async (string id, string familyMemberId, IMediator mediator, CancellationToken ct) =>
                    {
                        await mediator.Send(new DeleteFamilyMemberCommand(id, familyMemberId), ct);
                        return Results.NoContent();
                    })
                .WithName(nameof(DeleteFamilyMember))
                .WithTags(PlayerConstants.PlayerFeature)
                .Produces(StatusCodes.Status204NoContent)
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record DeleteFamilyMemberCommand(string TeamPlayerId, string FamilyMemberId) : RFFM.Api.Common.ICommand;

        public class Handler : IRequestHandler<DeleteFamilyMemberCommand, Unit>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db)
            {
                _db = db;
            }

            public async ValueTask<Unit> Handle(DeleteFamilyMemberCommand command, CancellationToken cancellationToken = default)
            {
                var familyMember = await _db.TeamPlayerFamilyMembers
                    .FirstOrDefaultAsync(f => f.Id == command.FamilyMemberId && f.TeamPlayerId == command.TeamPlayerId, cancellationToken);

                if (familyMember is null)
                    throw new NotFoundException($"FamilyMember '{command.FamilyMemberId}' Not Found", ErrorCodes.FamilyMemberNotFound);

                _db.TeamPlayerFamilyMembers.Remove(familyMember);
                await _db.SaveChangesAsync(cancellationToken);

                return Unit.Value;
            }
        }
    }
}
