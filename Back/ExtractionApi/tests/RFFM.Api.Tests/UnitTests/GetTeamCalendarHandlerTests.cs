#nullable enable
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Mobile.Competitions.Queries;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamCalendarHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamCalendarHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db, int? rffmCompetitionId, int? rffmGroupId)
        {
            var club = Club.Create($"Calendar Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Calendar Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = rffmCompetitionId,
                RffmGroupId = rffmGroupId
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_TeamAssociatedWithCompetition_ReturnsProjectedCalendar()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var matchDate = new DateTime(2026, 03, 15);
            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            Date = matchDate,
                            MatchDayNumber = 5,
                            Matches =
                            [
                                new MatchResponse
                                {
                                    Date = matchDate,
                                    Time = "12:00",
                                    LocalTeamName = "Home Team",
                                    LocalTeamImageUrl = "https://example.com/home.png",
                                    LocalGoals = "2",
                                    VisitorTeamName = "Away Team",
                                    VisitorTeamImageUrl = "https://example.com/away.png",
                                    VisitorGoals = "1",
                                    Status = "Finalizado"
                                }
                            ]
                        }
                    ]
                });

            var handler = new GetTeamCalendar.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamCalendar.MobileCalendarQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var matchDay = Assert.Single(result.MatchDays);
            Assert.Equal(5, matchDay.MatchDayNumber);
            var match = Assert.Single(matchDay.Matches);
            Assert.Equal("Home Team", match.LocalTeamName);
            Assert.Equal(2, match.LocalGoals);
            Assert.Equal("Away Team", match.VisitorTeamName);
            Assert.Equal(1, match.VisitorGoals);

            calendarServiceMock.Verify(
                s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task Handle_MatchNotYetPlayed_GoalsAreNullNotZero()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: 25255269, rffmGroupId: 25255283);

            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(25255269, 25255283, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            Date = new DateTime(2026, 06, 01),
                            MatchDayNumber = 10,
                            Matches =
                            [
                                new MatchResponse
                                {
                                    Date = new DateTime(2026, 06, 01),
                                    Time = "10:00",
                                    LocalTeamName = "Home Team",
                                    VisitorTeamName = "Away Team",
                                    LocalGoals = "",
                                    VisitorGoals = "",
                                    Status = "Pendiente"
                                }
                            ]
                        }
                    ]
                });

            var handler = new GetTeamCalendar.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamCalendar.MobileCalendarQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            var match = Assert.Single(Assert.Single(result.MatchDays).Matches);
            Assert.Null(match.LocalGoals);
            Assert.Null(match.VisitorGoals);
        }

        [Fact]
        public async Task Handle_TeamNotAssociatedWithCompetition_ReturnsEmptyWithoutCallingService()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db, rffmCompetitionId: null, rffmGroupId: null);

            var calendarServiceMock = new Mock<ICalendarService>();
            var handler = new GetTeamCalendar.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamCalendar.MobileCalendarQuery { TeamId = teamId };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Empty(result.MatchDays);
            calendarServiceMock.Verify(
                s => s.GetCalendarAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsDomainException()
        {
            // Arrange
            await using var db = _fixture.CreateDbContext();
            var calendarServiceMock = new Mock<ICalendarService>();
            var handler = new GetTeamCalendar.Handler(db, calendarServiceMock.Object);
            var query = new GetTeamCalendar.MobileCalendarQuery { TeamId = "non-existent-team-id" };

            // Act & Assert
            await Assert.ThrowsAsync<DomainException>(() => handler.Handle(query, CancellationToken.None).AsTask());
        }
    }
}
