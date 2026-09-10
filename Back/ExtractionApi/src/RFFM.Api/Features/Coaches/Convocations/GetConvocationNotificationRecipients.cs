using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Convocations
{
    /// <summary>
    /// Read-only endpoint (openspec change convocation-pending-confirmation-whatsapp) that, for
    /// a given event and a set of requested `teamPlayerId`s, resolves each player's WhatsApp
    /// notification-eligible family members: those with an approved (registered) app account and
    /// a non-empty phone number. See
    /// openspec/changes/convocation-pending-confirmation-whatsapp/design.md Decision 1.
    /// </summary>
    public class GetConvocationNotificationRecipients : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/events/{eventId}/convocations/notification-recipients",
                    async (string eventId, [FromQuery] string[] teamPlayerIds, AppDbContext db,
                           IMediator mediator, CancellationToken cancellationToken) =>
                    {
                        var sportEvent = await db.SportEvents.AsNoTracking()
                            .FirstOrDefaultAsync(se => se.Id == eventId, cancellationToken);
                        if (sportEvent == null) throw new DomainException("Evento", "Evento no encontrado", "EventNotFound");

                        return await mediator.Send(
                            new ConvocationNotificationRecipientsQuery
                            {
                                EventId = eventId,
                                TeamPlayerIds = teamPlayerIds ?? Array.Empty<string>(),
                                TeamId = sportEvent.TeamId
                            },
                            cancellationToken);
                    })
                .WithName(nameof(GetConvocationNotificationRecipients))
                .WithTags("Convocations")
                .Produces<ConvocationNotificationRecipientsResponse>();
        }

        public record ConvocationNotificationRecipientsQuery
            : IQueryApp<ConvocationNotificationRecipientsResponse>, IRequireFeaturePermission, IRequireTeamMembership
        {
            public string EventId { get; init; } = null!;
            public string[] TeamPlayerIds { get; init; } = Array.Empty<string>();
            public string TeamId { get; set; } = null!;

            public string FeatureRoute => CoachFeatureRoutes.Convocations;
            public string RequiredPermission => "Read";
        }

        public record ConvocationNotificationRecipientsResponse(PlayerRecipients[] Players);

        public record PlayerRecipients(
            string TeamPlayerId,
            string PlayerAlias,
            FamilyRecipient[] FamilyMembers);

        public record FamilyRecipient(
            string FamilyMemberId,
            string? Name,
            string? LastName,
            string Phone,
            string? FamilyMember);

        public class Handler : IRequestHandler<ConvocationNotificationRecipientsQuery, ConvocationNotificationRecipientsResponse>
        {
            private readonly AppDbContext _db;

            public Handler(AppDbContext db) => _db = db;

            public async ValueTask<ConvocationNotificationRecipientsResponse> Handle(
                ConvocationNotificationRecipientsQuery request, CancellationToken cancellationToken = default)
            {
                var requestedIds = request.TeamPlayerIds ?? Array.Empty<string>();
                if (requestedIds.Length == 0)
                    return new ConvocationNotificationRecipientsResponse(Array.Empty<PlayerRecipients>());

                // Defense in depth: only consider ids that are actually convoked to this event,
                // silently dropping stale ids from a client-side selection rather than erroring
                // the whole batch (design.md Decision 1, step 2).
                var convokedTeamPlayerIds = await _db.Convocations
                    .AsNoTracking()
                    .Where(c => c.SportEventId == request.EventId && requestedIds.Contains(c.TeamPlayerId))
                    .Select(c => c.TeamPlayerId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                var teamPlayers = await _db.TeamPlayers
                    .AsNoTracking()
                    .Include(tp => tp.Player)
                    .Include(tp => tp.FamilyMembers)
                    .Where(tp => convokedTeamPlayerIds.Contains(tp.Id))
                    .ToListAsync(cancellationToken);

                var teamPlayersById = teamPlayers.ToDictionary(tp => tp.Id);

                var players = requestedIds
                    .Where(id => teamPlayersById.ContainsKey(id))
                    .Select(id =>
                    {
                        var teamPlayer = teamPlayersById[id];
                        var familyMembers = (teamPlayer.FamilyMembers ?? new List<Domain.Entities.TeamPlayers.TeamPlayerFamilyMember>())
                            .Where(f =>
                                FamilyMemberRegistrationStatus.Resolve(f.LinkedUserId, hasPendingAccountRequest: false)
                                    == FamilyMemberRegistrationStatus.Approved
                                && !string.IsNullOrWhiteSpace(f.Phone))
                            .Select(f => new FamilyRecipient(f.Id, f.Name, f.LastName, f.Phone!, f.FamilyMember))
                            .ToArray();

                        return new PlayerRecipients(id, teamPlayer.Player.Alias, familyMembers);
                    })
                    .ToArray();

                return new ConvocationNotificationRecipientsResponse(players);
            }
        }
    }
}
