using EasyCaching.Core;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Storage;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class SyncCalendarFromFederation : IFeatureModule
    {
        private const string RivalsContainerName = "rivalphotos";

        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/sport-events/sync-calendar",
                    async (SyncCalendarRequest req, AppDbContext db,
                        IStorageService storage,
                        IEasyCachingProviderFactory cachingFactory,
                        CancellationToken cancellationToken) =>
                    {
                        int created = 0;
                        int updated = 0;
                        int failed = 0;
                        var savedEvents = new List<SportEventSaveResponse>();

                        // ── 0. Update own team shield if needed ──────────────────────────────
                        if (!string.IsNullOrEmpty(req.MyTeamShieldUrl))
                        {
                            var team = await db.Teams.FirstOrDefaultAsync(t => t.Id == req.TeamId, cancellationToken);
                            if (team != null && string.IsNullOrEmpty(team.UrlPhoto))
                            {
                                // Try to upload to Supabase; if it fails, keep the external URL
                                var uploadedUrl = req.MyTeamShieldUrl;
                                try
                                {
                                    var download = await storage.DownloadAsync(req.MyTeamShieldUrl, cancellationToken);
                                    if (download.HasValue)
                                    {
                                        var ext = GetImageExtension(download.Value.ContentType);
                                        var fileName = $"{Guid.NewGuid()}{ext}";
                                        uploadedUrl = await storage.UploadBytesAsync(
                                            "teamphotos", fileName,
                                            download.Value.Content, download.Value.ContentType,
                                            cancellationToken);
                                    }
                                }
                                catch
                                {
                                    // Upload failed; use the external URL directly
                                }
                                team.UrlPhoto = uploadedUrl;
                                await db.SaveChangesAsync(cancellationToken);
                            }
                        }

                        // Load all existing rivals once (avoid N+1)
                        var allRivals = await db.Rivals.ToListAsync(cancellationToken);
                        var rivalsByName = allRivals
                            .GroupBy(r => r.Name.Trim().ToLowerInvariant())
                            .ToDictionary(g => g.Key, g => g.First());

                        foreach (var match in req.Matches)
                        {
                          try
                          {
                            // ── 1. Resolve or create rival ──────────────────────────────────
                            // Truncate to 100 chars to satisfy domain constraint
                            var rivalNameSafe = (match.RivalName ?? "Rival desconocido").Trim();
                            if (rivalNameSafe.Length > 100) rivalNameSafe = rivalNameSafe[..100];

                            var normalizedName = rivalNameSafe.ToLowerInvariant();
                            if (!rivalsByName.TryGetValue(normalizedName, out var rival))
                            {
                                rival = new Rival(rivalNameSafe, null, null);
                                db.Rivals.Add(rival);
                                rivalsByName[normalizedName] = rival;
                                allRivals.Add(rival);
                            }

                            // ── 2. Download and store rival shield if needed ─────────────────
                            if (!string.IsNullOrEmpty(match.RivalShieldUrl)
                                && string.IsNullOrEmpty(rival.UrlPhoto))
                            {
                                // Default to the external URL immediately (works even without Supabase bucket)
                                rival.SetUrlPhoto(match.RivalShieldUrl);
                                try
                                {
                                    var download = await storage.DownloadAsync(match.RivalShieldUrl, cancellationToken);
                                    if (download.HasValue)
                                    {
                                        var ext = GetImageExtension(download.Value.ContentType);
                                        var fileName = $"{Guid.NewGuid()}{ext}";
                                        var storedUrl = await storage.UploadBytesAsync(
                                            RivalsContainerName, fileName,
                                            download.Value.Content, download.Value.ContentType,
                                            cancellationToken);
                                        rival.SetUrlPhoto(storedUrl);
                                    }
                                }
                                catch
                                {
                                    // Supabase upload failed; keep the external URL as fallback
                                }
                            }

                            // Save rival changes (new or photo updated) before linking
                            await db.SaveChangesAsync(cancellationToken);

                            // ── 3. Find existing sport event ─────────────────────────────────
                            var matchDateUtc = DateTime.SpecifyKind(match.MatchDate.Date, DateTimeKind.Utc);
                            var nextDayUtc = matchDateUtc.AddDays(1);

                            SportEvent? existing = null;

                            // Prefer matching by CodActa if provided
                            if (!string.IsNullOrEmpty(match.CodActa))
                            {
                                existing = await db.SportEvents
                                    .FirstOrDefaultAsync(e =>
                                        e.TeamId == req.TeamId &&
                                        e.CodActa == match.CodActa,
                                        cancellationToken);
                            }

                            // Fallback: match by teamId + date (date-only window)
                            if (existing is null)
                            {
                                existing = await db.SportEvents
                                    .FirstOrDefaultAsync(e =>
                                        e.TeamId == req.TeamId &&
                                        e.EveDateTime >= matchDateUtc &&
                                        e.EveDateTime < nextDayUtc &&
                                        e.EventTypeId == SportEventsConstants.MatchEventTypeId,
                                        cancellationToken);
                            }

                            // ── 4. Build combined date+time ──────────────────────────────────
                            var eveDateTime = BuildMatchDateTime(match.MatchDate, match.MatchTime);

                            var name = BuildMatchName(match.IsHomeMatch, rivalNameSafe);

                            // ── 5. Create or update ──────────────────────────────────────────
                            if (existing is not null)
                            {
                                existing.Name = name;
                                existing.EveDateTime = eveDateTime;
                                existing.StartTime = eveDateTime;
                                existing.Location = match.Field;
                                existing.RivalId = rival.Id;
                                existing.IsHomeMatch = match.IsHomeMatch;
                                existing.CodActa = match.CodActa;
                                if (!string.IsNullOrEmpty(match.LocalGoals)) existing.LocalGoals = match.LocalGoals;
                                if (!string.IsNullOrEmpty(match.VisitorGoals)) existing.VisitorGoals = match.VisitorGoals;

                                updated++;
                                savedEvents.Add(new SportEventSaveResponse(
                                    existing.Id, existing.Name, existing.EveDateTime, existing.StartTime,
                                    existing.EndTime, existing.ArrivalDate, existing.Location, existing.Description,
                                    existing.EventTypeId, existing.TeamId, existing.RivalId,
                                    existing.IsHomeMatch, existing.CodActa, existing.RecurrenceId, existing.IsRecurrenceMaster, null));
                            }
                            else
                            {
                                var newEvent = SportEvent.CreateNew(
                                    name, eveDateTime, eveDateTime, null, null,
                                    match.Field, null,
                                    SportEventsConstants.MatchEventTypeId,
                                    req.TeamId, rival.Id,
                                    match.IsHomeMatch, match.CodActa,
                                    match.LocalGoals, match.VisitorGoals);

                                db.SportEvents.Add(newEvent);
                                created++;
                                savedEvents.Add(new SportEventSaveResponse(
                                    newEvent.Id, newEvent.Name, newEvent.EveDateTime, newEvent.StartTime,
                                    newEvent.EndTime, newEvent.ArrivalDate, newEvent.Location, newEvent.Description,
                                    newEvent.EventTypeId, newEvent.TeamId, newEvent.RivalId,
                                    newEvent.IsHomeMatch, newEvent.CodActa, newEvent.RecurrenceId, newEvent.IsRecurrenceMaster, null));
                            }

                            await db.SaveChangesAsync(cancellationToken);
                          }
                          catch
                          {
                              // This match failed; continue with the rest
                              failed++;
                              // Detach any tracked entities that may be in an invalid state
                              db.ChangeTracker.Clear();
                          }
                        }

                        // Invalidate rivals cache after potential creates/updates
                        var cache = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
                        await cache.RemoveAsync("Rivals", cancellationToken);

                        return Results.Ok(new SyncCalendarResponse(created, updated, failed, savedEvents.ToArray()));
                    })
                .WithName(nameof(SyncCalendarFromFederation))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SyncCalendarResponse>()
                .Produces(StatusCodes.Status400BadRequest);
        }

        private static DateTime BuildMatchDateTime(DateTime matchDate, string? matchTime)
        {
            var baseDate = matchDate.Date;
            if (!string.IsNullOrWhiteSpace(matchTime)
                && TimeSpan.TryParse(matchTime, out var time))
            {
                baseDate = baseDate.Add(time);
            }
            return DateTime.SpecifyKind(baseDate, DateTimeKind.Utc);
        }

        private static string BuildMatchName(bool isHomeMatch, string rivalName)
        {
            return isHomeMatch
                ? $"vs {rivalName}"
                : $"@ {rivalName}";
        }

        private static string GetImageExtension(string contentType) => contentType switch
        {
            "image/png" => ".png",
            "image/gif" => ".gif",
            "image/webp" => ".webp",
            _ => ".jpg"
        };
    }

    public record SyncCalendarRequest(
        string TeamId,
        SyncMatchItem[] Matches,
        string? MyTeamShieldUrl
    );

    public record SyncMatchItem(
        string RivalName,
        string? RivalShieldUrl,
        DateTime MatchDate,
        string? MatchTime,
        string? Field,
        bool IsHomeMatch,
        string? CodActa,
        string? LocalGoals,
        string? VisitorGoals
    );

    public class SyncCalendarRequestValidator : AbstractValidator<SyncCalendarRequest>
    {
        public SyncCalendarRequestValidator()
        {
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.Matches).NotNull();
            RuleForEach(x => x.Matches).ChildRules(m =>
            {
                m.RuleFor(x => x.RivalName).NotEmpty().MaximumLength(100);
            });
        }
    }

    public record SyncCalendarResponse(int Created, int Updated, int Failed, SportEventSaveResponse[] Events);
}
