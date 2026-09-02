using System.Linq;
using EasyCaching.Core;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Common.Behaviors;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Entities;
using RFFM.Api.FeatureModules;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Features.Mobile.PushNotifications;
using RFFM.Api.Infrastructure.Persistence;

namespace RFFM.Api.Features.Coaches.SportEvents.Commands
{
    public class CreateSportEvent : IFeatureModule
    {
        public void AddRoutes(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/sport-events",
                    async (CreateSportEventRequest req, AppDbContext db, IPushNotificationDispatcher dispatcher,
                           FluentValidation.IValidator<CreateSportEventRequest> validator, IEasyCachingProviderFactory cachingFactory,
                           CancellationToken cancellationToken) =>
                    {
                        var validationResult = await validator.ValidateAsync(req, cancellationToken);
                        if (!validationResult.IsValid)
                        {
                            return Results.ValidationProblem(validationResult.ToDictionary());
                        }

                        var resolvedTeamId = await db.Teams
                            .Where(t => t.Id.Trim() == req.TeamId.Trim())
                            .Select(t => t.Id)
                            .FirstOrDefaultAsync(cancellationToken);

                        if (string.IsNullOrWhiteSpace(resolvedTeamId))
                        {
                            return Results.BadRequest($"El equipo '{req.TeamId}' no existe.");
                        }

                        string? resolvedRivalId;
                        if (req.NewRival is not null)
                        {
                            var rival = new Rival(req.NewRival.Name, req.NewRival.UrlPhoto, req.NewRival.Category);
                            db.Rivals.Add(rival);
                            resolvedRivalId = rival.Id;
                        }
                        else if (req.RivalId is not null)
                        {
                            resolvedRivalId = (await db.Rivals.Select(r => r.Id).ToListAsync(cancellationToken))
                                .FirstOrDefault(id => id.Trim() == req.RivalId.Trim()) ?? req.RivalId;
                        }
                        else
                        {
                            resolvedRivalId = null;
                        }

                        var eveDateTimeUtc = req.EveDateTime.HasValue
                            ? DateTime.SpecifyKind(req.EveDateTime.Value, DateTimeKind.Utc)
                            : (DateTime?)null;
                        var startTimeSourceUtc = req.StartTime ?? req.EveDateTime;
                        var startTimeUtc = startTimeSourceUtc.HasValue
                            ? DateTime.SpecifyKind(startTimeSourceUtc.Value, DateTimeKind.Utc)
                            : (DateTime?)null;

                        var ev = SportEvent.CreateNew(
                            req.Name,
                            eveDateTimeUtc,
                            startTimeUtc,
                            req.EndTime.HasValue ? DateTime.SpecifyKind(req.EndTime.Value, DateTimeKind.Utc) : null,
                            req.ArrivalDate.HasValue ? DateTime.SpecifyKind(req.ArrivalDate.Value, DateTimeKind.Utc) : null,
                            req.Location,
                            req.Description,
                            req.EventTypeId,
                            resolvedTeamId,
                            resolvedRivalId,
                            req.IsHomeMatch ?? true,
                            req.CodActa,
                            localGoals: null,
                            visitorGoals: null,
                            locationMapUrl: req.LocationMapUrl
                        );

                        EventRecurrence? recurrence = null;
                        var instances = Array.Empty<SportEvent>();

                        // The master SportEvent must be persisted (unlinked) before EventRecurrence
                        // can be created, because EventRecurrence.MasterEventId and
                        // SportEvent.RecurrenceId are FKs pointing at each other: adding both as new
                        // rows in the same SaveChanges is rejected by EF Core as a circular
                        // dependency (neither insert can be ordered before the other).
                        db.SportEvents.Add(ev);
                        await db.SaveChangesAsync(cancellationToken);

                        if (req.NewRival is not null)
                        {
                            var cache = cachingFactory.GetCachingProvider(Cache.CacheDefaultName);
                            await cache.RemoveAsync("Rivals", cancellationToken);
                        }

                        if (req.Recurrence is not null)
                        {
                            // CreateSportEventValidator requires EveDateTime whenever Recurrence is
                            // present, so this is guaranteed non-null here — the exception below
                            // documents that invariant rather than silently trusting a `.Value`.
                            var anchorEveDateTime = ev.EveDateTime
                                ?? throw new InvalidOperationException("Recurrence sin EveDateTime tras validación");

                            var frequency = RecurrenceFrequency.FromCode(req.Recurrence.Frequency);
                            var endDateUtc = DateTime.SpecifyKind(req.Recurrence.EndDate, DateTimeKind.Utc);
                            var dates = RecurrenceScheduler.GenerateDates(anchorEveDateTime, frequency, endDateUtc);

                            recurrence = EventRecurrence.Create(frequency, endDateUtc, ev.Id, dates.Count);
                            ev.RecurrenceId = recurrence.Id;
                            ev.IsRecurrenceMaster = true;

                            var startOffset = (ev.StartTime ?? anchorEveDateTime) - anchorEveDateTime;
                            var endOffset = ev.EndTime.HasValue ? ev.EndTime.Value - anchorEveDateTime : (TimeSpan?)null;
                            var arrivalOffset = ev.ArrivalDate.HasValue ? ev.ArrivalDate.Value - anchorEveDateTime : (TimeSpan?)null;

                            instances = dates.Skip(1)
                                .Select(d => SportEvent.CreateNew(
                                    ev.Name,
                                    d,
                                    d.Add(startOffset),
                                    endOffset.HasValue ? d.Add(endOffset.Value) : (DateTime?)null,
                                    arrivalOffset.HasValue ? d.Add(arrivalOffset.Value) : (DateTime?)null,
                                    ev.Location,
                                    ev.Description,
                                    ev.EventTypeId,
                                    ev.TeamId,
                                    ev.RivalId,
                                    ev.IsHomeMatch,
                                    null, // CodActa is match-specific, never copied to generated instances
                                    localGoals: null,
                                    visitorGoals: null,
                                    locationMapUrl: ev.LocationMapUrl
                                ))
                                .ToArray();

                            foreach (var instance in instances)
                            {
                                instance.RecurrenceId = recurrence.Id;
                            }

                            db.EventRecurrences.Add(recurrence);
                            db.SportEvents.AddRange(instances);
                            await db.SaveChangesAsync(cancellationToken);
                        }

                        // Dispatch once for the master event only — not per generated recurrence
                        // instance, to avoid notification spam for a long recurring series.
                        await dispatcher.DispatchCalendarChangedAsync(ev.Id, ev.TeamId, cancellationToken);

                        return Results.Ok(new SportEventSaveResponse(ev.Id, ev.Name, ev.EveDateTime, ev.StartTime, ev.EndTime, ev.ArrivalDate, ev.Location, ev.LocationMapUrl, ev.Description, ev.EventTypeId, ev.TeamId, ev.RivalId, ev.IsHomeMatch, ev.CodActa, ev.RecurrenceId, ev.IsRecurrenceMaster, recurrence?.InstanceCount));
                    })
                .WithName(nameof(CreateSportEvent))
                .WithTags(SportEventsConstants.SportEventsFeature)
                .Produces<SportEventSaveResponse>()
                .Produces(StatusCodes.Status400BadRequest);
        }
    }

    public record CreateSportEventRequest(
        string Name,
        DateTime? EveDateTime,
        DateTime? StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? Description,
        int EventTypeId,
        string TeamId,
        string? RivalId,
        bool? IsHomeMatch,
        string? CodActa,
        RecurrenceRequest? Recurrence = null,
        NewRivalRequest? NewRival = null,
        string? LocationMapUrl = null
    );

    public record RecurrenceRequest(
        string Frequency,
        DateTime EndDate
    );

    public record NewRivalRequest(
        string Name,
        string? UrlPhoto,
        string? Category
    );

    public class CreateSportEventValidator : AbstractValidator<CreateSportEventRequest>
    {
        public CreateSportEventValidator()
        {
            RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
            RuleFor(x => x.TeamId).NotEmpty();
            RuleFor(x => x.EventTypeId).GreaterThan(0);

            RuleFor(x => x.LocationMapUrl)
                .Must(BeAWellFormedHttpUrl)
                .WithMessage("El enlace de ubicación debe ser una URL http(s) válida")
                .When(x => !string.IsNullOrEmpty(x.LocationMapUrl));

            RuleFor(x => x)
                .Must(x => x.RivalId is null || x.NewRival is null)
                .WithMessage("No se puede indicar un rival existente y uno nuevo a la vez");

            When(x => x.NewRival is not null, () =>
            {
                RuleFor(x => x.NewRival!.Name).NotEmpty().MaximumLength(100);
                RuleFor(x => x.NewRival!.Category).MaximumLength(50);
                RuleFor(x => x.NewRival!.UrlPhoto).MaximumLength(256);
            });

            When(x => x.Recurrence is not null, () =>
            {
                RuleFor(x => x.Recurrence!.Frequency)
                    .Must(f => RecurrenceFrequency.IsValidCode(f))
                    .WithMessage("La frecuencia debe ser 'daily', 'weekly' o 'monthly'");

                RuleFor(x => x.EveDateTime)
                    .NotNull()
                    .WithMessage("La recurrencia requiere una fecha de evento");
            });

            When(x => x.Recurrence is not null && x.EveDateTime.HasValue, () =>
            {
                RuleFor(x => x.Recurrence!.EndDate)
                    .GreaterThan(x => x.EveDateTime!.Value)
                    .WithMessage("La fecha final de la recurrencia debe ser posterior a la fecha del evento");

                RuleFor(x => x)
                    .Must(BeWithinInstanceCap)
                    .WithMessage($"Una serie recurrente no puede generar más de {RecurrenceConstants.MaxInstances} eventos; acorta la fecha final o cambia la frecuencia");
            });
        }

        private static bool BeAWellFormedHttpUrl(string? url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

        private static bool BeWithinInstanceCap(CreateSportEventRequest request)
        {
            if (!RecurrenceFrequency.IsValidCode(request.Recurrence!.Frequency))
            {
                // Frequency-validity rule above already reports this; do not double-fail here.
                return true;
            }
            var frequency = RecurrenceFrequency.FromCode(request.Recurrence.Frequency);
            var dates = RecurrenceScheduler.GenerateDates(request.EveDateTime!.Value, frequency, request.Recurrence.EndDate);
            return dates.Count <= RecurrenceConstants.MaxInstances;
        }
    }

    public record SportEventSaveResponse(
        string Id,
        string Name,
        DateTime? EveDateTime,
        DateTime? StartTime,
        DateTime? EndTime,
        DateTime? ArrivalDate,
        string? Location,
        string? LocationMapUrl,
        string? Description,
        int EventTypeId,
        string TeamId,
        string? RivalId,
        bool IsHomeMatch,
        string? CodActa,
        string? RecurrenceId,
        bool IsRecurrenceMaster,
        int? RecurrenceInstanceCount
    );
}
