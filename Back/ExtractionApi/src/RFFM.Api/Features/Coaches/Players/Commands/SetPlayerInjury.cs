using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    public class SetPlayerInjury : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            // GET all injuries for a team player
            app.MapGet("/api/catalog/teamplayer/{id}/injuries",
                async (string id, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    var injuries = await db.TeamPlayerInjuries
                        .AsNoTracking()
                        .Where(i => i.TeamPlayerId == id)
                        .OrderByDescending(i => i.StartDate)
                        .ToListAsync(ct);

                    return Results.Ok(injuries.Select(ToResponse).ToArray());
                })
            .WithName("GetPlayerInjuries")
            .WithTags(PlayerConstants.PlayerFeature)
            .Produces<InjuryRecordResponse[]>()
            .RequireAuthorization();

            // POST create injury
            app.MapPost("/api/catalog/teamplayer/{id}/injuries",
                async (string id, InjuryCreateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    var injury = TeamPlayerInjury.Create(id, req.StartDate, req.InjuryType, req.Description, req.EstimatedRecovery);
                    db.TeamPlayerInjuries.Add(injury);
                    await db.SaveChangesAsync(ct);

                    return Results.Created(
                        $"/api/catalog/teamplayer/{id}/injuries/{injury.Id}",
                        ToResponse(injury));
                })
            .WithName("CreatePlayerInjury")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<InjuryCreateRequest>("application/json")
            .Produces<InjuryRecordResponse>(StatusCodes.Status201Created)
            .RequireAuthorization();

            // PUT update injury
            app.MapPut("/api/catalog/teamplayer/{id}/injuries/{injuryId}",
                async (string id, string injuryId, InjuryUpdateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var injury = await db.TeamPlayerInjuries
                        .FirstOrDefaultAsync(i => i.Id == injuryId && i.TeamPlayerId == id, ct);
                    if (injury == null) return Results.NotFound();

                    injury.Update(req.StartDate, req.InjuryType, req.Description, req.EstimatedRecovery, req.EndDate);
                    await db.SaveChangesAsync(ct);

                    return Results.Ok(ToResponse(injury));
                })
            .WithName("UpdatePlayerInjury")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<InjuryUpdateRequest>("application/json")
            .Produces<InjuryRecordResponse>()
            .RequireAuthorization();

            // DELETE injury
            app.MapDelete("/api/catalog/teamplayer/{id}/injuries/{injuryId}",
                async (string id, string injuryId, AppDbContext db, CancellationToken ct) =>
                {
                    var injury = await db.TeamPlayerInjuries
                        .FirstOrDefaultAsync(i => i.Id == injuryId && i.TeamPlayerId == id, ct);
                    if (injury == null) return Results.NotFound();

                    db.TeamPlayerInjuries.Remove(injury);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeletePlayerInjury")
            .WithTags(PlayerConstants.PlayerFeature)
            .RequireAuthorization();
        }

        static InjuryRecordResponse ToResponse(TeamPlayerInjury i)
            => new(i.Id, i.StartDate, i.InjuryType, i.Description, i.EstimatedRecovery, i.EndDate);

        public record InjuryCreateRequest(DateTime StartDate, string InjuryType, string? Description, string? EstimatedRecovery);
        public record InjuryUpdateRequest(DateTime StartDate, string InjuryType, string? Description, string? EstimatedRecovery, DateTime? EndDate);
        public record InjuryRecordResponse(string Id, DateTime StartDate, string InjuryType, string? Description, string? EstimatedRecovery, DateTime? EndDate);
    }
}

