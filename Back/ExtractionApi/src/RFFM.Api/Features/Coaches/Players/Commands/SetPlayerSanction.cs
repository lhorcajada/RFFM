using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.FeatureModules;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.Players.Commands
{
    // Mirrors SetPlayerInjury.cs's rationale exactly: inline Minimal API handlers (not Mediator
    // ICommand/IQueryApp) for a simple per-teamplayer CRUD sub-resource, so FluentValidation /
    // FeaturePermissionBehavior don't apply here either. GET stays open to every authenticated
    // role; writes are restricted via [Authorize(Roles = "Coach,Administrator")].
    public class SetPlayerSanction : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            // GET all sanctions for a team player, optional ?category= filter
            app.MapGet("/api/catalog/teamplayer/{id}/sanctions",
                async (string id, string? category, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    SanctionCategory? categoryFilter = null;
                    if (!string.IsNullOrWhiteSpace(category))
                    {
                        if (!SanctionCategory.TryParseName(category, out categoryFilter))
                            return Results.ValidationProblem(new Dictionary<string, string[]>
                            {
                                ["category"] = new[] { $"Categoría de sanción desconocida: '{category}'." }
                            });
                    }

                    var query = db.TeamPlayerSanctions
                        .AsNoTracking()
                        .Where(s => s.TeamPlayerId == id);

                    if (categoryFilter is not null)
                        query = query.Where(s => s.Category == categoryFilter);

                    var sanctions = await query
                        .OrderByDescending(s => s.StartDate)
                        .ToListAsync(ct);

                    return Results.Ok(sanctions.Select(ToResponse).ToArray());
                })
            .WithName("GetPlayerSanctions")
            .WithTags(PlayerConstants.PlayerFeature)
            .Produces<SanctionRecordResponse[]>()
            .RequireAuthorization();

            // GET all sanctions for every player of a team, in a single call
            app.MapGet("/api/catalog/team/{teamId}/sanctions",
                async (string teamId, AppDbContext db, CancellationToken ct) =>
                {
                    var sanctions = await db.TeamPlayerSanctions
                        .AsNoTracking()
                        .Where(s => s.TeamPlayer.TeamId == teamId)
                        .OrderByDescending(s => s.StartDate)
                        .ToListAsync(ct);

                    var grouped = sanctions
                        .GroupBy(s => s.TeamPlayerId)
                        .Select(g => new TeamPlayerSanctionsResponse(g.Key, g.Select(ToResponse).ToArray()))
                        .ToArray();

                    return Results.Ok(grouped);
                })
            .WithName("GetTeamSanctions")
            .WithTags(PlayerConstants.PlayerFeature)
            .Produces<TeamPlayerSanctionsResponse[]>()
            .RequireAuthorization();

            // POST create sanction
            app.MapPost("/api/catalog/teamplayer/{id}/sanctions",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, SanctionCreateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    var sanction = TeamPlayerSanction.Create(id, category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd);
                    db.TeamPlayerSanctions.Add(sanction);
                    await db.SaveChangesAsync(ct);

                    return Results.Created(
                        $"/api/catalog/teamplayer/{id}/sanctions/{sanction.Id}",
                        ToResponse(sanction));
                })
            .WithName("CreatePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<SanctionCreateRequest>("application/json")
            .Produces<SanctionRecordResponse>(StatusCodes.Status201Created)
            .RequireAuthorization();

            // PUT update sanction
            app.MapPut("/api/catalog/teamplayer/{id}/sanctions/{sanctionId}",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, string sanctionId, SanctionUpdateRequest req, AppDbContext db, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    sanction.Update(category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd, req.EndDate);
                    await db.SaveChangesAsync(ct);

                    return Results.Ok(ToResponse(sanction));
                })
            .WithName("UpdatePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .Accepts<SanctionUpdateRequest>("application/json")
            .Produces<SanctionRecordResponse>()
            .RequireAuthorization();

            // DELETE sanction
            app.MapDelete("/api/catalog/teamplayer/{id}/sanctions/{sanctionId}",
                [Authorize(Roles = "Coach,Administrator")]
                async (string id, string sanctionId, AppDbContext db, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    db.TeamPlayerSanctions.Remove(sanction);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeletePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .RequireAuthorization();
        }

        static SanctionRecordResponse ToResponse(TeamPlayerSanction s)
            => new(s.Id, s.Category.Name, s.StartDate, s.SanctionType, s.Description, s.EstimatedEnd, s.EndDate);

        public record SanctionCreateRequest(string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd);
        public record SanctionUpdateRequest(string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd, DateTime? EndDate);
        public record SanctionRecordResponse(string Id, string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd, DateTime? EndDate);
        public record TeamPlayerSanctionsResponse(string TeamPlayerId, SanctionRecordResponse[] Sanctions);
    }
}
