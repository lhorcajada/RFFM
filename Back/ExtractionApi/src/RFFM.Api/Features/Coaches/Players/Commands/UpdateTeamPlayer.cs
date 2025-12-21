using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain.Models;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.ValueObjects.Player;
using RFFM.Api.Domain.ValueObjects;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class UpdateTeamPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/teamplayer/{id}",
                    async (string id, UpdateRequest req, AppDbContext db, CancellationToken cancellationToken) =>
                    {
                        var item = await db.TeamPlayers
                            .Include(tp => tp.Demarcation)
                            .Include(tp => tp.ContactInfo)
                            .Include(tp => tp.PhysicalInfo)
                            .Include(tp => tp.FamilyMembers)
                            .FirstOrDefaultAsync(tp => tp.Id == id, cancellationToken);

                        if (item == null)
                            return Results.NotFound();

                        // update dorsal
                        if (req.Dorsal.HasValue)
                        {
                            item.SetDorsal(req.Dorsal.Value);
                        }

                        // update player basic info
                        if (req.PlayerInfo != null)
                        {
                            var playerEntity = await db.Players.FirstOrDefaultAsync(p => p.Id == item.PlayerId, cancellationToken);
                            if (playerEntity != null)
                            {
                                if (!string.IsNullOrEmpty(req.PlayerInfo.Name)) playerEntity.UpdateName(req.PlayerInfo.Name);
                                if (req.PlayerInfo.LastName != null) playerEntity.UpdateLastName(req.PlayerInfo.LastName);
                                if (!string.IsNullOrEmpty(req.PlayerInfo.Alias)) playerEntity.UpdateAlias(req.PlayerInfo.Alias);
                                if (req.PlayerInfo.UrlPhoto != null) playerEntity.UpdateUrlPhoto(req.PlayerInfo.UrlPhoto);
                            }
                        }

                        // update demarcation: activePositionId and possibleDemarcations (ids)
                        if (req.Demarcation != null)
                        {
                            item.SetDemarcation(new DemarcationModel
                            {
                                ActivePositionId = req.Demarcation.ActivePositionId ?? 0,
                                PossibleDemarcations = req.Demarcation.PossibleDemarcations?.ToList() ?? new List<int>()
                            });
                        }

                        // contact
                        if (req.ContactInfo != null)
                        {
                            item.SetContactInfo(new ContactModel
                            {
                                Phone = req.ContactInfo.Phone,
                                Email = req.ContactInfo.Email
                            });
                        }

                        // physical
                        if (req.PhysicalInfo != null)
                        {
                            item.SetPhysicalInfo(req.PhysicalInfo.Height, req.PhysicalInfo.Weight, req.PhysicalInfo.DominantFootId);
                        }

                        // family members
                        if (req.FamilyMembers != null)
                        {
                            item.SetFamily(req.FamilyMembers.Select(f => new FamilyModel { Name = f.Name, Phone = f.Phone, Email = f.Email, FamilyMemberId = f.FamilyMemberId }).ToList());
                        }

                        await db.SaveChangesAsync(cancellationToken);

                        // map to response similar to GetTeamPlayer
                        var player = await db.Players.AsNoTracking().FirstOrDefaultAsync(p => p.Id == item.PlayerId, cancellationToken);

                        var playerModel = new PlayerModel
                        {
                            Id = player?.Id ?? string.Empty,
                            Alias = player?.Alias ?? string.Empty,
                            Name = player?.Name ?? string.Empty,
                            LastName = player?.LastName,
                            BirthDate = player?.BirthDate,
                            Dni = player?.Dni,
                            UrlPhoto = player?.UrlPhoto,
                            ClubId = player?.ClubId
                        };

                        int? dorsal = item.Dorsal?.Number;

                        DemarcationResponse? demarcationResp = null;
                        if (item.Demarcation != null)
                        {
                            var active = item.Demarcation.GetActivePosition();
                            var possible = item.Demarcation.GetPossibleDemarcations()?.Select(d => d?.Name ?? string.Empty).Where(n => !string.IsNullOrEmpty(n)).ToArray() ?? Array.Empty<string>();
                            demarcationResp = new DemarcationResponse(item.Demarcation.ActivePositionId, active?.Name, possible);
                        }

                        ContactInfoResponse? contact = null;
                        if (item.ContactInfo != null)
                        {
                            var addr = item.ContactInfo.Address;
                            var addrResp = addr != null ? new AddressResponse(addr.Street, addr.City, addr.Province, addr.PostalCode, addr.Country) : null;
                            contact = new ContactInfoResponse(addrResp, item.ContactInfo.Phone, item.ContactInfo.Email);
                        }

                        PhysicalInfoResponse? phys = null;
                        if (item.PhysicalInfo != null)
                        {
                            var foot = item.PhysicalInfo.DominantFoot;
                            phys = new PhysicalInfoResponse(item.PhysicalInfo.Height, item.PhysicalInfo.Weight, foot?.Name);
                        }

                        var fams = (item.FamilyMembers ?? new List<Family>())
                            .Select(f => new FamilyResponse(f.Name, f.Phone, f.Email, f.FamilyMember))
                            .ToArray();

                        var resp = new TeamPlayerResponse(
                            item.Id,
                            item.PlayerId,
                            playerModel,
                            item.TeamId,
                            item.JoinedDate,
                            item.LeftDate,
                            dorsal,
                            demarcationResp,
                            contact,
                            phys,
                            fams
                        );

                        return Results.Ok(resp);
                    })
                .WithName(nameof(UpdateTeamPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Accepts<UpdateRequest>("application/json")
                .Produces<TeamPlayerResponse>();
        }

        public record UpdateRequest(
            int? Dorsal,
            PlayerInfoRequest? PlayerInfo,
            DemarcationRequest? Demarcation,
            ContactRequest? ContactInfo,
            PhysicalRequest? PhysicalInfo,
            FamilyRequest[]? FamilyMembers
        );

        public record PlayerInfoRequest(string? Name, string? LastName, string? Alias, string? UrlPhoto);

        public record DemarcationRequest(int? ActivePositionId, int[]? PossibleDemarcations);
        public record ContactRequest(string? Phone, string? Email);
        public record PhysicalRequest(decimal? Height, decimal? Weight, int? DominantFootId);
        public record FamilyRequest(string? Name, string? Phone, string? Email, int? FamilyMemberId);

        // Response types reused from GetTeamPlayer
        public record AddressResponse(string? Street, string? City, string? Province, string? PostalCode, string? Country);
        public record ContactInfoResponse(AddressResponse? Address, string? Phone, string? Email);
        public record PhysicalInfoResponse(decimal? Height, decimal? Weight, string? DominantFoot);
        public record DemarcationResponse(int? ActivePositionId, string? ActivePositionName, string[] PossibleDemarcations);
        public record FamilyResponse(string? Name, string? Phone, string? Email, string? FamilyMember);

        public record TeamPlayerResponse(
            string Id,
            string PlayerId,
            PlayerModel Player,
            string TeamId,
            DateTime JoinedDate,
            DateTime? LeftDate,
            int? Dorsal,
            DemarcationResponse? Demarcation,
            ContactInfoResponse? ContactInfo,
            PhysicalInfoResponse? PhysicalInfo,
            FamilyResponse[] FamilyMembers
        );
    }
}
