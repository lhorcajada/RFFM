using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Services;
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
                        .Include(s => s.TargetEvent)
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
                        .Include(s => s.TargetEvent)
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
                async (string id, SanctionCreateRequest req, AppDbContext db,
                    ISanctionConvocationEnforcementService enforcementService, CancellationToken ct) =>
                {
                    var exists = await db.TeamPlayers.AnyAsync(tp => tp.Id == id, ct);
                    if (!exists) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    var punishmentValidation = await ValidateSportivePunishmentRequestAsync(
                        db, req.SportivePunishmentType, req.TargetEventId, req.MinutesLimit, ct);
                    if (punishmentValidation.Problem is not null) return punishmentValidation.Problem;

                    if (!ValidateAmountPaid(req.Fine, req.AmountPaid, out var amountPaidProblem))
                        return amountPaidProblem!;

                    TeamPlayerSanction sanction;
                    try
                    {
                        sanction = TeamPlayerSanction.Create(
                            id, category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd,
                            req.Fine, req.AmountPaid, punishmentValidation.Type, req.TargetEventId, req.MinutesLimit);
                    }
                    catch (ArgumentException ex)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]> { ["sanction"] = new[] { ex.Message } });
                    }

                    db.TeamPlayerSanctions.Add(sanction);

                    if (punishmentValidation.Type == SanctionSportivePunishmentType.Deconvocation)
                    {
                        await enforcementService.ForceDeconvocationAsync(
                            id, req.TargetEventId!, ExcuseTypes.SportiveSanction.Id, ct);
                        sanction.MarkFulfilled(DateTime.UtcNow);
                    }

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
                async (string id, string sanctionId, SanctionUpdateRequest req, AppDbContext db,
                    ISanctionConvocationEnforcementService enforcementService, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .Include(s => s.TargetEvent)
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    if (!SanctionCategory.TryParseName(req.Category, out var category))
                        return Results.ValidationProblem(new Dictionary<string, string[]>
                        {
                            ["category"] = new[] { $"Categoría de sanción desconocida: '{req.Category}'." }
                        });

                    var punishmentValidation = await ValidateSportivePunishmentRequestAsync(
                        db, req.SportivePunishmentType, req.TargetEventId, req.MinutesLimit, ct);
                    if (punishmentValidation.Problem is not null) return punishmentValidation.Problem;

                    if (!ValidateAmountPaid(req.Fine, req.AmountPaid, out var amountPaidProblem))
                        return amountPaidProblem!;

                    // design.md Decisión 7: time-boxed edit rules for a Deconvocation sanction's
                    // punishment-defining fields (sportivePunishmentType, targetEventId, minutesLimit).
                    var oldWasDeconvocation = sanction.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation;
                    var oldTargetEventId = sanction.TargetEventId;
                    var oldTargetEventIsPast = sanction.TargetEvent is not null && sanction.TargetEvent.EveDateTime <= DateTime.UtcNow;
                    var newIsDeconvocation = punishmentValidation.Type == SanctionSportivePunishmentType.Deconvocation;
                    var punishmentFieldsChanged =
                        sanction.SportivePunishmentType != punishmentValidation.Type ||
                        sanction.TargetEventId != req.TargetEventId ||
                        sanction.MinutesLimit != req.MinutesLimit;

                    if (oldWasDeconvocation && punishmentFieldsChanged && oldTargetEventIsPast)
                    {
                        return Results.Problem(
                            detail: "No se puede modificar la sanción de desconvocatoria de un evento ya pasado.",
                            statusCode: StatusCodes.Status409Conflict);
                    }

                    if (oldWasDeconvocation && punishmentFieldsChanged && !oldTargetEventIsPast && oldTargetEventId is not null)
                    {
                        await enforcementService.TryRevertForcedDeconvocationAsync(id, oldTargetEventId, ct);
                    }

                    try
                    {
                        sanction.Update(
                            category!, req.StartDate, req.SanctionType, req.Description, req.EstimatedEnd, req.EndDate,
                            req.Fine, req.AmountPaid, punishmentValidation.Type, req.TargetEventId, req.MinutesLimit);
                    }
                    catch (ArgumentException ex)
                    {
                        return Results.ValidationProblem(new Dictionary<string, string[]> { ["sanction"] = new[] { ex.Message } });
                    }

                    if (newIsDeconvocation && punishmentFieldsChanged)
                    {
                        await enforcementService.ForceDeconvocationAsync(id, req.TargetEventId!, ExcuseTypes.SportiveSanction.Id, ct);
                        sanction.MarkFulfilled(DateTime.UtcNow);
                    }

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
                async (string id, string sanctionId, AppDbContext db,
                    ISanctionConvocationEnforcementService enforcementService, CancellationToken ct) =>
                {
                    var sanction = await db.TeamPlayerSanctions
                        .Include(s => s.TargetEvent)
                        .FirstOrDefaultAsync(s => s.Id == sanctionId && s.TeamPlayerId == id, ct);
                    if (sanction == null) return Results.NotFound();

                    var isFulfilled = sanction.EndDate is not null;
                    if (isFulfilled)
                    {
                        var isReversibleForcedDeconvocation =
                            sanction.SportivePunishmentType == SanctionSportivePunishmentType.Deconvocation &&
                            sanction.TargetEvent is not null &&
                            sanction.TargetEvent.EveDateTime > DateTime.UtcNow;

                        if (!isReversibleForcedDeconvocation)
                        {
                            return Results.Problem(
                                detail: "No se puede eliminar una sanción ya cumplida.",
                                statusCode: StatusCodes.Status409Conflict);
                        }

                        var reverted = await enforcementService.TryRevertForcedDeconvocationAsync(id, sanction.TargetEventId!, ct);
                        db.TeamPlayerSanctions.Remove(sanction);
                        await db.SaveChangesAsync(ct);

                        if (!reverted)
                        {
                            return Results.Ok(new
                            {
                                detail = "La sanción se eliminó, pero la convocatoria ya no coincidía con el estado forzado y debe corregirse manualmente."
                            });
                        }

                        return Results.NoContent();
                    }

                    db.TeamPlayerSanctions.Remove(sanction);
                    await db.SaveChangesAsync(ct);

                    return Results.NoContent();
                })
            .WithName("DeletePlayerSanction")
            .WithTags(PlayerConstants.PlayerFeature)
            .RequireAuthorization();
        }

        private static bool ValidateAmountPaid(decimal? fine, decimal? amountPaid, out IResult? problem)
        {
            problem = null;
            if (amountPaid is null) return true;

            if (amountPaid < 0)
            {
                problem = Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["amountPaid"] = new[] { "El importe pagado no puede ser negativo." }
                });
                return false;
            }

            if (amountPaid > (fine ?? 0))
            {
                problem = Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["amountPaid"] = new[] { "El importe pagado no puede superar la multa." }
                });
                return false;
            }

            return true;
        }

        private static async Task<(SanctionSportivePunishmentType? Type, IResult? Problem)> ValidateSportivePunishmentRequestAsync(
            AppDbContext db, string? sportivePunishmentTypeName, string? targetEventId, int? minutesLimit, CancellationToken ct)
        {
            SanctionSportivePunishmentType? type = null;
            if (!string.IsNullOrWhiteSpace(sportivePunishmentTypeName))
            {
                if (!SanctionSportivePunishmentType.TryParseName(sportivePunishmentTypeName, out type))
                {
                    return (null, Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["sportivePunishmentType"] = new[] { $"Tipo de sanción deportiva desconocido: '{sportivePunishmentTypeName}'." }
                    }));
                }
            }

            if (type is not null)
            {
                if (string.IsNullOrWhiteSpace(targetEventId))
                {
                    return (null, Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["targetEventId"] = new[] { "El evento objetivo es obligatorio para una sanción deportiva." }
                    }));
                }

                var eventExists = await db.SportEvents.AsNoTracking().AnyAsync(se => se.Id == targetEventId, ct);
                if (!eventExists) return (null, Results.NotFound());
            }
            else if (!string.IsNullOrWhiteSpace(targetEventId) || minutesLimit is not null)
            {
                return (null, Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["sportivePunishmentType"] = new[] { "El evento objetivo o el límite de minutos requieren especificar un tipo de sanción deportiva." }
                }));
            }

            return (type, null);
        }

        static SanctionRecordResponse ToResponse(TeamPlayerSanction s)
        {
            var status = s.EndDate is null ? "Pending" : "Fulfilled";
            var pendingAmount = s.Fine is null ? (decimal?)null : s.Fine.Value - (s.AmountPaid ?? 0);

            return new(
                s.Id, s.Category.Name, s.StartDate, s.SanctionType, s.Description, s.EstimatedEnd, s.EndDate, s.IsAutomatic, s.Fine,
                s.SportivePunishmentType?.Name, s.TargetEventId, s.MinutesLimit, s.AmountPaid, pendingAmount, status);
        }

        public record SanctionCreateRequest(
            string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd,
            decimal? Fine = null, decimal? AmountPaid = null, string? SportivePunishmentType = null,
            string? TargetEventId = null, int? MinutesLimit = null);

        public record SanctionUpdateRequest(
            string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd,
            DateTime? EndDate, decimal? Fine = null, decimal? AmountPaid = null, string? SportivePunishmentType = null,
            string? TargetEventId = null, int? MinutesLimit = null);

        public record SanctionRecordResponse(
            string Id, string Category, DateTime StartDate, string SanctionType, string? Description, string? EstimatedEnd,
            DateTime? EndDate, bool IsAutomatic, decimal? Fine, string? SportivePunishmentType = null,
            string? TargetEventId = null, int? MinutesLimit = null, decimal? AmountPaid = null,
            decimal? PendingAmount = null, string Status = "Pending");

        public record TeamPlayerSanctionsResponse(string TeamPlayerId, SanctionRecordResponse[] Sanctions);
    }
}
