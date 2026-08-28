#nullable enable
using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
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
    /// Regression tests for a security/availability bug: PUT
    /// /api/events/{eventId}/convocations/{convocationId}/status returned 401 for Player and
    /// FamilyMember users even when responding to their OWN convocation, because
    /// UserProfile.PlayerId stores a TeamPlayer.Id (see VerifyPlayerIdentity.cs) while the handler
    /// compared it against conv.Player.PlayerId (the master Player.Id) -- two different ID spaces,
    /// so the ownership check always failed and threw UnauthorizedAccessException (mapped to 401),
    /// which the frontend's global 401 handler misreads as an expired session.
    ///
    /// Fix: compare against conv.TeamPlayerId (same ID space as UserProfile.PlayerId), and throw
    /// ForbiddenAccessException (403) instead of UnauthorizedAccessException (401) for genuine
    /// ownership violations, following the same pattern already used in
    /// ConfigurationCoachHandlerTests / ConfigurationCoach.cs.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class UpdateConvocationStatusHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public UpdateConvocationStatusHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static Mock<ICurrentUserService> CurrentUser(string userId, params string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns(roles);
            return mock;
        }

        private Task<(string EventId, string TeamPlayerId, string ConvocationId)> SeedConvocationAsync(AppDbContext db)
            => SeedConvocationAsync(db, eventTypeId: 2, convocationStatusId: 1);

        private async Task<(string EventId, string TeamPlayerId, string ConvocationId)> SeedConvocationAsync(
            AppDbContext db, int eventTypeId, int convocationStatusId)
        {
            var club = Club.Create($"Convocation Auth Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow,
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Convocation Auth Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test",
                LastName = "Player",
                Alias = $"testplayer-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new System.Collections.Generic.List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Convocation Auth Test Event",
                DateTime.UtcNow.AddDays(1),
                DateTime.UtcNow.AddDays(1),
                null, null, null, null,
                eventTypeId, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEvent.Id,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ResponseDateTime = DateTime.UtcNow,
                ConvocationStatusId = convocationStatusId,
                ExcuseTypeId = null
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();

            return (sportEvent.Id, teamPlayer.Id, convocation.Id);
        }

        [Fact]
        public async Task PlayerAcceptsOwnConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerRejectsOwnConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 5
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task FamilyMemberAcceptsAssociatedPlayerConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db);

            var userId = $"family-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "FamilyMember", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "FamilyMember").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task FamilyMemberRejectsAssociatedPlayerConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db);

            var userId = $"family-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "FamilyMember", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "FamilyMember").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 5
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerAttemptsAnotherPlayersConvocation_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            // Attacker is a Player but associated with a DIFFERENT team player.
            var attackerId = $"attacker-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(attackerId, "Player", "some-other-team-player-id", null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(attackerId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));

            var untouched = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(1, untouched.ConvocationStatusId);
        }

        [Fact]
        public async Task FamilyMemberAttemptsAnotherPlayersConvocation_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var attackerId = $"attacker-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(attackerId, "FamilyMember", "some-other-team-player-id", null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(attackerId, "FamilyMember").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));
        }

        [Fact]
        public async Task PlayerWithNoUserProfile_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var userId = $"noprofile-{Guid.NewGuid():N}";
            // No UserProfile row seeded for this user at all.

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));
        }

        [Fact]
        public async Task CoachUpdatesAnyConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var coachId = $"coach-{Guid.NewGuid():N}";
            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(coachId, "Coach").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task AdministratorUpdatesAnyConvocation_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db);

            var adminId = $"admin-{Guid.NewGuid():N}";
            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(adminId, "Administrator").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerReactivatesDeconvokedConvocation_OnTrainingEvent_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 2, convocationStatusId: 5);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task FamilyMemberReactivatesDeconvokedConvocation_OnTrainingEvent_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 2, convocationStatusId: 5);

            var userId = $"family-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "FamilyMember", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "FamilyMember").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 1
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(1, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerReactivatesDeconvokedConvocation_OnMatchEvent_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 1, convocationStatusId: 5);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));

            var untouched = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, untouched.ConvocationStatusId);
        }

        [Fact]
        public async Task FamilyMemberReactivatesDeconvokedConvocation_OnFriendlyMatchEvent_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 4, convocationStatusId: 5);

            var userId = $"family-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "FamilyMember", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "FamilyMember").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 1
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));

            var untouched = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, untouched.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerReactivatesDeconvokedConvocation_OnTournamentEvent_ThrowsForbiddenAccessException()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 6, convocationStatusId: 5);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await Assert.ThrowsAsync<ForbiddenAccessException>(
                async () => await handler.Handle(request, CancellationToken.None));

            var untouched = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, untouched.ConvocationStatusId);
        }

        [Fact]
        public async Task CoachReactivatesDeconvokedConvocation_OnMatchEvent_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db, eventTypeId: 1, convocationStatusId: 5);

            var coachId = $"coach-{Guid.NewGuid():N}";
            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(coachId, "Coach").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task AdministratorReactivatesDeconvokedConvocation_OnMatchEvent_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _, convocationId) = await SeedConvocationAsync(db, eventTypeId: 1, convocationStatusId: 5);

            var adminId = $"admin-{Guid.NewGuid():N}";
            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(adminId, "Administrator").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 2
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(2, updated.ConvocationStatusId);
        }

        [Fact]
        public async Task PlayerDeclinesOwnPendingConvocation_OnMatchEvent_Succeeds()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, teamPlayerId, convocationId) = await SeedConvocationAsync(db, eventTypeId: 1, convocationStatusId: 1);

            var userId = $"player-{Guid.NewGuid():N}";
            db.UserProfiles.Add(new UserProfile(userId, "Player", teamPlayerId, null));
            await db.SaveChangesAsync();

            var handler = new UpdateConvocationStatus.Handler(db, CurrentUser(userId, "Player").Object);
            var request = new UpdateConvocationStatus.UpdateStatusRequest
            {
                EventId = eventId,
                ConvocationId = convocationId,
                NewStatusId = 5
            };

            await handler.Handle(request, CancellationToken.None);

            var updated = await db.Convocations.AsNoTracking().FirstAsync(c => c.Id == convocationId);
            Assert.Equal(5, updated.ConvocationStatusId);
        }
    }
}
