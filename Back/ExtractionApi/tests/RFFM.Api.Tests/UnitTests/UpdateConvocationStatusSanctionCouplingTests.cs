#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// Covers UpdateConvocationStatus.Handler's sanction coupling (design.md Decisión 4/11,
    /// tasks.md 4.12/4.13): the defensive auto-fulfillment path when a coach manually
    /// deconvokes a player matching a Pending Deconvocation sanction, and the reverse coupling
    /// that reopens a Fulfilled Deconvocation sanction when its forced convocation is later
    /// transitioned away from Deconvoke through this endpoint.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateConvocationStatusSanctionCouplingTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int MatchEventTypeId = SportEventType.FromName("Partido").Id;

        public UpdateConvocationStatusSanctionCouplingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> Coach()
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns($"coach-{Guid.NewGuid():N}");
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns(new[] { "Coach" });
            return mock;
        }

        private async Task<(string TeamId, string TeamPlayerId)> SeedTeamAndPlayerAsync(AppDbContext db)
        {
            var club = Club.Create($"SanctionCoupling Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "SanctionCoupling Test Team", CategoryId = Category.NationalCategory.Id, ClubId = club.Id, SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test", LastName = "Player", Alias = $"testplayer-{Guid.NewGuid():N}", ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id, TeamId = team.Id, SeasonId = season.Id, JoinedDate = DateTime.UtcNow,
                Dorsal = null, FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id);
        }

        private async Task<string> SeedSportEventAsync(AppDbContext db, string teamId, DateTime eveDateTime)
        {
            var sportEvent = SportEvent.CreateNew(
                "SanctionCoupling Test Event", eveDateTime, eveDateTime, null, null, null, null, MatchEventTypeId, teamId, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return sportEvent.Id;
        }

        private async Task<string> SeedConvocationAsync(AppDbContext db, string teamPlayerId, string eventId, int statusId, int? excuseTypeId)
        {
            var conv = Convocation.Create(new ConvocationModel
            {
                EventId = eventId, TeamPlayerId = teamPlayerId, AssistanceTypeId = null,
                ConvocationStatusId = statusId, ExcuseTypeId = excuseTypeId
            });
            db.Convocations.Add(conv);
            await db.SaveChangesAsync();
            return conv.Id;
        }

        [Fact]
        public async Task DeconvokingForSanctionedEvent_FulfillsMatchingPendingSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, eventId, statusId: 1, excuseTypeId: null);

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Sanción",
                null, null, sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: eventId);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = eventId, ConvocationId = convocationId, NewStatusId = 5 };

            await handler.Handle(request, CancellationToken.None);

            var reloadedSanction = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.NotNull(reloadedSanction.EndDate);
            var reloadedConv = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(ExcuseTypes.SportiveSanction.Id, reloadedConv.ExcuseTypeId);
        }

        [Fact]
        public async Task DeconvokingForUnrelatedEvent_DoesNotFulfillSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var sanctionedEventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));
            var otherEventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(6));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, otherEventId, statusId: 1, excuseTypeId: null);

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Sanción",
                null, null, sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: sanctionedEventId);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = otherEventId, ConvocationId = convocationId, NewStatusId = 5 };

            await handler.Handle(request, CancellationToken.None);

            var reloadedSanction = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.Null(reloadedSanction.EndDate);
        }

        [Fact]
        public async Task RevertingForcedDeconvocation_ReopensFulfilledSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, eventId, statusId: 5, excuseTypeId: ExcuseTypes.SportiveSanction.Id);

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Sanción",
                null, null, sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: eventId);
            sanction.MarkFulfilled(DateTime.UtcNow);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = eventId, ConvocationId = convocationId, NewStatusId = 1 };

            await handler.Handle(request, CancellationToken.None);

            var reloadedSanction = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.Null(reloadedSanction.EndDate);
        }

        [Fact]
        public async Task RevertingUnrelatedDeconvocation_DoesNotAffectUnrelatedSanction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, eventId, statusId: 5, excuseTypeId: 7);

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = eventId, ConvocationId = convocationId, NewStatusId = 1 };

            // Should succeed with no sanctions in the db at all (no lookup blows up).
            await handler.Handle(request, CancellationToken.None);

            var reloadedConv = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(1, reloadedConv.ConvocationStatusId);
        }

        [Fact]
        public async Task StatusChangeNotFromDeconvoke_NeverTriggersSanctionLookup()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var eventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(5));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, eventId, statusId: 1, excuseTypeId: null);

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow, "Sanción",
                null, null, sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: eventId);
            sanction.MarkFulfilled(DateTime.UtcNow);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = eventId, ConvocationId = convocationId, NewStatusId = 2 };

            await handler.Handle(request, CancellationToken.None);

            // Previous status was Pending (1), not Deconvoke, so the Fulfilled sanction must stay untouched.
            var reloadedSanction = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.NotNull(reloadedSanction.EndDate);
        }

        [Fact]
        public async Task ReopeningSanction_AllowedEvenForPastEvent()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId) = await SeedTeamAndPlayerAsync(db);
            var pastEventId = await SeedSportEventAsync(db, teamId, DateTime.UtcNow.AddDays(-5));
            var convocationId = await SeedConvocationAsync(db, teamPlayerId, pastEventId, statusId: 5, excuseTypeId: ExcuseTypes.SportiveSanction.Id);

            var sanction = TeamPlayerSanction.Create(
                teamPlayerId, SanctionCategory.InternalDiscipline, DateTime.UtcNow.AddDays(-6), "Sanción",
                null, null, sportivePunishmentType: SanctionSportivePunishmentType.Deconvocation, targetEventId: pastEventId);
            sanction.MarkFulfilled(DateTime.UtcNow);
            db.TeamPlayerSanctions.Add(sanction);
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, Coach().Object, new SanctionConvocationEnforcementService(db));
            var request = new UpdateConvocationStatus.UpdateStatusRequest { EventId = pastEventId, ConvocationId = convocationId, NewStatusId = 4 };

            await handler.Handle(request, CancellationToken.None);

            var reloadedSanction = await db.TeamPlayerSanctions.AsNoTracking().FirstAsync(s => s.Id == sanction.Id);
            Assert.Null(reloadedSanction.EndDate);
        }
    }
}
