using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Domain.ValueObjects.Player;
using RFFM.Api.Domain.ValueObjects;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    // Intentionally not gated by IRequireFeaturePermission: this route is an inline Minimal API
    // handler (not a Mediator ICommand/IQueryApp), so FeaturePermissionBehavior cannot intercept
    // it without a refactor to CQRS. Restricted directly via [Authorize(Roles = ...)] instead,
    // mirroring the pattern used by CreateConceptualRating and CreateTeamPlayerRating.
    //
    // Player/FamilyMember are also allowed (openspec change
    // player-self-edit-physical-family-contact), but only for their OWN linked TeamPlayer
    // (UserTeam.LinkedTeamPlayerId, same ownership check as ConfirmAttendance.cs), and only for
    // ContactInfo/PhysicalInfo/FamilyMembers/PlayerInfo.UrlPhoto -- Dorsal, Demarcation and the
    // rest of PlayerInfo are silently ignored for those roles rather than rejected.
    public class UpdateTeamPlayer : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPut("/api/catalog/teamplayer/{id}",
                    [Authorize(Roles = "Coach,Administrator,Player,FamilyMember")]
                    async (string id, UpdateRequest req, AppDbContext db, ICurrentUserService currentUser, CancellationToken cancellationToken) =>
                    {
                        var isPrivileged = (currentUser.Roles ?? Enumerable.Empty<string>())
                            .Any(r => string.Equals(r, AppRoles.Coach.Name, StringComparison.OrdinalIgnoreCase) ||
                                      string.Equals(r, AppRoles.Administrator.Name, StringComparison.OrdinalIgnoreCase));

                        if (!isPrivileged)
                        {
                            var isOwnPlayer = await db.Set<UserTeam>()
                                .AsNoTracking()
                                .AnyAsync(ut =>
                                    ut.ApplicationUserId == currentUser.UserId &&
                                    ut.LinkedTeamPlayerId == id,
                                    cancellationToken);

                            if (!isOwnPlayer)
                                return Results.Problem(
                                    statusCode: StatusCodes.Status403Forbidden,
                                    title: "No autorizado",
                                    detail: "No tienes permiso para editar esta ficha de jugador.",
                                    extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.TeamPlayerEditForbidden });

                            // Player/FamilyMember may only touch Contact/Physical/Family and the
                            // player's photo -- silently ignore the rest instead of rejecting.
                            req = req with
                            {
                                Dorsal = null,
                                Demarcation = null,
                                PlayerInfo = req.PlayerInfo is null
                                    ? null
                                    : new PlayerInfoRequest(null, null, null, req.PlayerInfo.UrlPhoto,
                                        req.PlayerInfo.Enfermedades, req.PlayerInfo.Alergias, req.PlayerInfo.Procedencia),
                            };
                        }

                        var item = await db.TeamPlayers
                            .Include(tp => tp.Demarcation)
                            .Include(tp => tp.ContactInfo)
                            .Include(tp => tp.PhysicalInfo)
                            .Include(tp => tp.FamilyMembers)
                            .Include(tp => tp.Injuries)
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
                                if (req.PlayerInfo.Enfermedades != null) playerEntity.UpdateEnfermedades(req.PlayerInfo.Enfermedades);
                                if (req.PlayerInfo.Alergias != null) playerEntity.UpdateAlergias(req.PlayerInfo.Alergias);
                                if (req.PlayerInfo.Procedencia != null) playerEntity.UpdateProcedencia(req.PlayerInfo.Procedencia);
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
                            var existingAddress = item.ContactInfo?.Address;
                            var reqAddress = req.ContactInfo.Address;

                            AddressModel? addressModel = null;
                            if (reqAddress != null)
                            {
                                addressModel = new AddressModel
                                {
                                    Street = reqAddress.Street ?? string.Empty,
                                    City = reqAddress.City ?? string.Empty,
                                    Province = reqAddress.Province ?? string.Empty,
                                    PostalCode = reqAddress.PostalCode ?? string.Empty,
                                    Country = reqAddress.Country ?? string.Empty
                                };
                            }
                            else if (existingAddress != null)
                            {
                                addressModel = new AddressModel
                                {
                                    Street = existingAddress.Street ?? string.Empty,
                                    City = existingAddress.City ?? string.Empty,
                                    Province = existingAddress.Province ?? string.Empty,
                                    PostalCode = existingAddress.PostalCode ?? string.Empty,
                                    Country = existingAddress.Country ?? string.Empty
                                };
                            }

                            item.SetContactInfo(new ContactModel
                            {
                                Phone = req.ContactInfo.Phone,
                                Email = req.ContactInfo.Email,
                                Address = addressModel
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
                            item.SetFamily(req.FamilyMembers.Select(f => new FamilyModel { Name = f.Name, Phone = f.Phone, Email = f.Email, FamilyMemberId = f.FamilyMemberId, Dni = f.Dni }).ToList());
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
                            Enfermedades = player?.Enfermedades,
                            Alergias = player?.Alergias,
                            Procedencia = player?.Procedencia,
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
                            .Select(f => new FamilyResponse(f.Name, f.Phone, f.Email, f.FamilyMember, f.Dni))
                            .ToArray();

                        InjuryInfoResponse? injuryResp = item.Injuries is { } injuries
                            ? injuries.Where(i => i.EndDate == null)
                                      .Select(i => new InjuryInfoResponse(i.Id, i.StartDate, i.InjuryType, i.Description, i.EstimatedRecovery, i.EndDate))
                                      .FirstOrDefault()
                            : null;

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
                            fams,
                            injuryResp
                        );

                        return Results.Ok(resp);
                    })
                .WithName(nameof(UpdateTeamPlayer))
                .WithTags(PlayerConstants.PlayerFeature)
                .Accepts<UpdateRequest>("application/json")
                .Produces<TeamPlayerResponse>()
                .Produces(StatusCodes.Status404NotFound)
                .Produces(StatusCodes.Status403Forbidden);
        }

        public record UpdateRequest(
            int? Dorsal,
            PlayerInfoRequest? PlayerInfo,
            DemarcationRequest? Demarcation,
            ContactRequest? ContactInfo,
            PhysicalRequest? PhysicalInfo,
            FamilyRequest[]? FamilyMembers
        );

        public record PlayerInfoRequest(string? Name, string? LastName, string? Alias, string? UrlPhoto,
            string? Enfermedades = null, string? Alergias = null, string? Procedencia = null);

        public record DemarcationRequest(int? ActivePositionId, int[]? PossibleDemarcations);
        public record AddressRequest(string? Street, string? City, string? Province, string? PostalCode, string? Country);
        public record ContactRequest(string? Phone, string? Email, AddressRequest? Address = null);
        public record PhysicalRequest(decimal? Height, decimal? Weight, int? DominantFootId);
        public record FamilyRequest(string? Name, string? Phone, string? Email, int? FamilyMemberId, string? Dni = null);

        // Response types reused from GetTeamPlayer
        public record AddressResponse(string? Street, string? City, string? Province, string? PostalCode, string? Country);
        public record ContactInfoResponse(AddressResponse? Address, string? Phone, string? Email);
        public record PhysicalInfoResponse(decimal? Height, decimal? Weight, string? DominantFoot);
        public record DemarcationResponse(int? ActivePositionId, string? ActivePositionName, string[] PossibleDemarcations);
        public record FamilyResponse(string? Name, string? Phone, string? Email, string? FamilyMember, string? Dni = null);
        public record InjuryInfoResponse(string Id, DateTime StartDate, string InjuryType, string? Description, string? EstimatedRecovery, DateTime? EndDate);

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
            FamilyResponse[] FamilyMembers,
            InjuryInfoResponse? InjuryInfo
        );
    }
}
