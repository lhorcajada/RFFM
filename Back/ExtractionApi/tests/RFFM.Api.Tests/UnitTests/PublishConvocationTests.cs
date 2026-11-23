#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Domain.Services;
using RFFM.Api.Features.Coaches.Convocations;
using RFFM.Api.Features.Coaches.Notifications.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class PublishConvocationTests
    {
        private readonly PostgresContainerFixture _fixture;
        private static readonly int PendingStatusId = ConvocationStatus.FromName("Pending").Id;
        private static readonly int DeconvokeStatusId = ConvocationStatus.FromName("Deconvoke").Id;

        public PublishConvocationTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(string EventId, Team Team)> SeedEventAsync(AppDbContext db, int eventTypeId)
        {
            var club = Club.Create($"Publish Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Publish Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var eventDate = DateTime.UtcNow.AddDays(3);
            var sportEvent = SportEvent.CreateNew(
                "Partido vs Rival CF", eventDate, eventDate, null, null, null, null, eventTypeId, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();
            return (sportEvent.Id, team);
        }

        private static async Task<string> SeedConvocationAsync(AppDbContext db, string eventId, Team team, int statusId)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Test", LastName = "Player", Alias = $"publish-{Guid.NewGuid():N}", ClubId = team.ClubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = team.SeasonId,
                JoinedDate = DateTime.UtcNow,
                Dorsal = null,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            db.Convocations.Add(Convocation.Create(new ConvocationModel
            {
                EventId = eventId,
                TeamPlayerId = teamPlayer.Id,
                AssistanceTypeId = null,
                ConvocationStatusId = statusId
            }));
            await db.SaveChangesAsync();
            return teamPlayer.Id;
        }

        private static ICurrentUserService CurrentUser(string userId, params string[] roles)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(userId);
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns(roles);
            return mock.Object;
        }

        private static PublishConvocation.Handler CreateHandler(
            AppDbContext db, ICurrentUserService currentUser, IWebPushNotificationDispatcher dispatcher)
            => new(db, currentUser, dispatcher);

        private static ICurrentUserService Admin() => CurrentUser(Guid.NewGuid().ToString(), "Administrator");

        [Fact]
        public async Task Handle_LeagueMatch_MarksConvocationAsPublished()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _) = await SeedEventAsync(db, eventTypeId: 1);

            await CreateHandler(db, Admin(), Mock.Of<IWebPushNotificationDispatcher>())
                .Handle(new PublishConvocation.PublishConvocationCommand(eventId), CancellationToken.None);

            var stored = await db.SportEvents.AsNoTracking().FirstAsync(e => e.Id == eventId);
            Assert.NotNull(stored.ConvocationPublishedAt);
        }

        [Fact]
        public async Task Handle_LeagueMatch_NotifiesCalledPlayersButNotDeconvoked()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, team) = await SeedEventAsync(db, eventTypeId: 1);
            var calledId = await SeedConvocationAsync(db, eventId, team, PendingStatusId);
            var deconvokedId = await SeedConvocationAsync(db, eventId, team, DeconvokeStatusId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();

            await CreateHandler(db, Admin(), dispatcher.Object)
                .Handle(new PublishConvocation.PublishConvocationCommand(eventId), CancellationToken.None);

            dispatcher.Verify(d => d.DispatchConvocationCreatedAsync(calledId, eventId, It.IsAny<CancellationToken>()), Times.Once);
            dispatcher.Verify(d => d.DispatchConvocationCreatedAsync(deconvokedId, eventId, It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_AlreadyPublished_DoesNotNotifyAgain()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, team) = await SeedEventAsync(db, eventTypeId: 1);
            await SeedConvocationAsync(db, eventId, team, PendingStatusId);
            var dispatcher = new Mock<IWebPushNotificationDispatcher>();
            var handler = CreateHandler(db, Admin(), dispatcher.Object);
            var command = new PublishConvocation.PublishConvocationCommand(eventId);

            await handler.Handle(command, CancellationToken.None);
            await handler.Handle(command, CancellationToken.None);

            dispatcher.Verify(d => d.DispatchConvocationCreatedAsync(
                It.IsAny<string>(), eventId, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_FriendlyMatch_ThrowsConflict()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _) = await SeedEventAsync(db, eventTypeId: 4);

            await Assert.ThrowsAsync<ConflictException>(() => CreateHandler(db, Admin(), Mock.Of<IWebPushNotificationDispatcher>())
                .Handle(new PublishConvocation.PublishConvocationCommand(eventId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_CoachOutsideTheTeam_ThrowsForbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (eventId, _) = await SeedEventAsync(db, eventTypeId: 1);

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => CreateHandler(
                    db, CurrentUser(Guid.NewGuid().ToString(), "Coach"), Mock.Of<IWebPushNotificationDispatcher>())
                .Handle(new PublishConvocation.PublishConvocationCommand(eventId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_UnknownEvent_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler(db, Admin(), Mock.Of<IWebPushNotificationDispatcher>())
                .Handle(new PublishConvocation.PublishConvocationCommand("missing-event"), CancellationToken.None).AsTask());
        }
    }
}
