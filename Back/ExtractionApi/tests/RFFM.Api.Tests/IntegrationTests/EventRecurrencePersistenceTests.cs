#nullable enable
using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Proves the EventRecurrence table + SportEvent.RecurrenceId/IsRecurrenceMaster columns from
    /// the AddEventRecurrence migration round-trip correctly against a real Postgres instance —
    /// i.e. the EF configuration/migration in design.md §6 is actually correct, not just
    /// compiling. Builds entities the same way CreateSportEvent's endpoint handler does.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class EventRecurrencePersistenceTests
    {
        private readonly PostgresContainerFixture _fixture;

        public EventRecurrencePersistenceTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        [Fact]
        public async Task WeeklySeries_PersistsMasterAndInstancesLinkedByOneRecurrenceId()
        {
            // Arrange: seed a team and use it for the sport event
            await using var setupDb = _fixture.CreateDbContext();

            var club = Club.Create("Event Recurrence Test Club", 1);
            setupDb.Clubs.Add(club);
            await setupDb.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            setupDb.Seasons.Add(season);
            await setupDb.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Recurrence Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            setupDb.Teams.Add(team);
            await setupDb.SaveChangesAsync();

            var master = SportEvent.CreateNew(
                "Entrenamiento semanal",
                new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 8, 3, 18, 0, 0, DateTimeKind.Utc),
                null, null, null, null,
                2, team.Id, null);

            var frequency = RecurrenceFrequency.FromCode("weekly");
            var endDate = new DateTime(2026, 8, 24, 0, 0, 0, DateTimeKind.Utc);
            var dates = RecurrenceScheduler.GenerateDates(master.EveDateTime, frequency, endDate);
            var recurrence = EventRecurrence.Create(frequency, endDate, master.Id, dates.Count);

            var instances = dates.Skip(1)
                .Select(d => SportEvent.CreateNew(master.Name, d, d, null, null, null, null, master.EventTypeId, master.TeamId, null))
                .ToArray();
            foreach (var i in instances) i.RecurrenceId = recurrence.Id;

            // Two-phase save mirrors CreateSportEvent's endpoint handler: master and EventRecurrence
            // have FKs pointing at each other (RecurrenceId / MasterEventId), so both can't be
            // inserted as "Added" in the same SaveChanges — EF Core rejects that as a circular
            // dependency, and setting master.RecurrenceId before the recurrence row exists would
            // also violate the FK. The master must be persisted first, unlinked; only then can the
            // recurrence (whose MasterEventId now points at a real row) and the master's own
            // RecurrenceId update be saved together.
            await using var writeDb = _fixture.CreateDbContext();
            writeDb.SportEvents.Add(master);
            await writeDb.SaveChangesAsync();

            master.RecurrenceId = recurrence.Id;
            master.IsRecurrenceMaster = true;
            writeDb.EventRecurrences.Add(recurrence);
            writeDb.SportEvents.AddRange(instances);
            await writeDb.SaveChangesAsync();

            // Act: read back from a fresh context.
            await using var readDb = _fixture.CreateDbContext();
            var persisted = await readDb.SportEvents
                .Where(e => e.RecurrenceId == recurrence.Id)
                .ToListAsync();

            // Assert
            Assert.Equal(4, persisted.Count); // Aug 3, 10, 17, 24
            Assert.Single(persisted, e => e.IsRecurrenceMaster);
            Assert.Equal(4, persisted.Select(e => e.Id).Distinct().Count());

            var persistedRecurrence = await readDb.EventRecurrences.SingleAsync(r => r.Id == recurrence.Id);
            Assert.Equal(master.Id, persistedRecurrence.MasterEventId);
            Assert.Equal(4, persistedRecurrence.InstanceCount);
        }
    }
}
