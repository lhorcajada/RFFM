#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.SportEvents.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    // Source of truth for this handler is Convocation.ConvocationStatusId (the real convocation
    // form's status, written via UpdateConvocationStatus.cs — Pending=1, Accepted=2, Justified=4,
    // Deconvoke=5), NOT EventAttendanceConfirmation/AttendanceStatus, which belongs to the
    // separate, unrelated Mobile RSVP flow (ConfirmAttendance.cs) and is no longer read here.
    [Collection(PostgresCollection.Name)]
    public class GetEventAttendanceSummaryHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetEventAttendanceSummaryHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<(string TeamId, string TeamPlayerId, string SportEventId)> SeedTeamPlayerAndEventAsync(AppDbContext db)
        {
            var club = Club.Create($"Attendance Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Attendance Test Team",
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
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var sportEvent = SportEvent.CreateNew(
                "Test Event",
                DateTime.UtcNow.AddDays(1),
                null, null, null, null, null,
                1, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            return (team.Id, teamPlayer.Id, sportEvent.Id);
        }

        private async Task<string> SeedConvocationAsync(AppDbContext db, string sportEventId, string teamPlayerId, int convocationStatusId)
        {
            var convocation = Convocation.Create(new ConvocationModel
            {
                EventId = sportEventId,
                TeamPlayerId = teamPlayerId,
                ConvocationStatusId = convocationStatusId
            });
            db.Convocations.Add(convocation);
            await db.SaveChangesAsync();
            return convocation.Id;
        }

        [Fact]
        public async Task Handle_EventWithPendingConvocation_CountsAsPending()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Pending").Id);

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(1, summary.Convocados);
            Assert.Equal(1, summary.Pending);
            Assert.Equal(0, summary.Going);
            Assert.Equal(0, summary.NotGoing);
            Assert.Equal(0, summary.AttendancePercentage);
        }

        [Fact]
        public async Task Handle_EventWithAcceptedConvocation_CountsAsGoing()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Accepted").Id);

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(1, summary.Convocados);
            Assert.Equal(1, summary.Going);
            Assert.Equal(0, summary.Pending);
            Assert.Equal(0, summary.NotGoing);
            Assert.Equal(100, summary.AttendancePercentage);
        }

        [Fact]
        public async Task Handle_EventWithDeconvokedConvocation_CountsAsNotGoing()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Deconvoke").Id);

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(1, summary.Convocados);
            Assert.Equal(0, summary.Going);
            Assert.Equal(0, summary.Pending);
            Assert.Equal(1, summary.NotGoing);
            Assert.Equal(0, summary.AttendancePercentage);
        }

        [Fact]
        public async Task Handle_EventWithJustifiedConvocation_CountsAsNotGoing()
        {
            // Arrange — a justified absence is still bucketed as NotGoing for this aggregate
            // (design.md Decision 3, revised): Justified means the player will not attend, just
            // with an accepted excuse, which is what NotGoing communicates to the coach view.
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Justified").Id);

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(1, summary.Convocados);
            Assert.Equal(0, summary.Going);
            Assert.Equal(0, summary.Pending);
            Assert.Equal(1, summary.NotGoing);
        }

        [Fact]
        public async Task Handle_EventNotBelongingToTeam_IsOmittedFromResponse()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, sportEventId) = await SeedTeamPlayerAndEventAsync(db);

            // Create a second team and event
            var club = Club.Create($"Test Club 2 {Guid.NewGuid():N}", 1);
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

            var team2 = new Team(new TeamModelBase
            {
                Name = "Team 2",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team2);
            await db.SaveChangesAsync();

            var sportEvent2 = SportEvent.CreateNew(
                "Event 2",
                DateTime.UtcNow.AddDays(1),
                null, null, null, null, null,
                1, team2.Id, null);
            db.SportEvents.Add(sportEvent2);
            await db.SaveChangesAsync();

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId, sportEvent2.Id }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Single(result);
            Assert.Equal(sportEventId, result[0].EventId);
        }

        [Fact]
        public async Task Handle_EventWithZeroConvocados_ReturnsZeroPercentageNotNaN()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, _, sportEventId) = await SeedTeamPlayerAndEventAsync(db);

            // Act - do NOT create any convocation
            var handler = new GetEventAttendanceSummary.Handler(db, null!);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(0, summary.Convocados);
            Assert.Equal(0, summary.AttendancePercentage);
            Assert.False(double.IsNaN(summary.AttendancePercentage));
        }

        [Fact]
        public async Task Handle_CoachRole_ReturnsNullMyStatus()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Pending").Id);

            // Mock a coach user
            var mockCurrentUser = new MockCurrentUserService("coach-user-id", new[] { "Coach" });

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, mockCurrentUser);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Null(summary.MyStatus);
            Assert.Null(summary.MyStatusId);
            Assert.Null(summary.MyConvocationId);
        }

        [Fact]
        public async Task Handle_PlayerLinkedButNotConvokedToEvent_ReturnsNullMyStatus()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);

            // Deliberately do NOT create a Convocation for this player/event — the player is
            // linked to the team but was never convoked to this specific event.
            var userId = Guid.NewGuid().ToString();
            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = new MockCurrentUserService(userId, new[] { "Player" });

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, mockCurrentUser);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal(0, summary.Convocados);
            Assert.Null(summary.MyStatus);
            Assert.Null(summary.MyStatusId);
            Assert.Null(summary.MyConvocationId);
        }

        [Fact]
        public async Task Handle_PlayerConvokedAndAccepted_ReturnsMyStatusAndMyConvocationId()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            var convocationId = await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Accepted").Id);

            var userId = Guid.NewGuid().ToString();
            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = new MockCurrentUserService(userId, new[] { "Player" });

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, mockCurrentUser);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert — MyStatus echoes ConvocationStatus's own name ("Accepted"), not a
            // relabeled "Going", and MyConvocationId is the caller's own Convocation.Id, needed
            // by the frontend to call PUT /api/events/{eventId}/convocations/{convocationId}/status.
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal("Accepted", summary.MyStatus);
            Assert.Equal(ConvocationStatus.FromName("Accepted").Id, summary.MyStatusId);
            Assert.Equal(convocationId, summary.MyConvocationId);
        }

        [Fact]
        public async Task Handle_PlayerConvokedAndPending_ReturnsMyStatusPending()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var (teamId, teamPlayerId, sportEventId) = await SeedTeamPlayerAndEventAsync(db);
            var convocationId = await SeedConvocationAsync(db, sportEventId, teamPlayerId, ConvocationStatus.FromName("Pending").Id);

            var userId = Guid.NewGuid().ToString();
            var userTeam = new UserTeam(userId, teamId, Membership.Player.Id);
            db.Set<UserTeam>().Add(userTeam);
            await db.SaveChangesAsync();

            userTeam.LinkPlayer(teamPlayerId);
            await db.SaveChangesAsync();

            var mockCurrentUser = new MockCurrentUserService(userId, new[] { "Player" });

            // Act
            var handler = new GetEventAttendanceSummary.Handler(db, mockCurrentUser);
            var query = new GetEventAttendanceSummary.EventAttendanceSummaryQuery
            {
                TeamId = teamId,
                EventIds = new[] { sportEventId }
            };

            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotEmpty(result);
            var summary = result.First(r => r.EventId == sportEventId);
            Assert.Equal("Pending", summary.MyStatus);
            Assert.Equal(ConvocationStatus.FromName("Pending").Id, summary.MyStatusId);
            Assert.Equal(convocationId, summary.MyConvocationId);
        }
    }

    // Simple mock implementation for ICurrentUserService
    internal class MockCurrentUserService : ICurrentUserService
    {
        private readonly string _userId;
        private readonly string[] _roles;

        public MockCurrentUserService(string userId, string[] roles)
        {
            _userId = userId;
            _roles = roles;
        }

        public string? UserId => _userId;
        public string? Role => _roles.FirstOrDefault();
        public IEnumerable<string> Roles => _roles;
        public bool IsAuthenticated => true;
    }
}
