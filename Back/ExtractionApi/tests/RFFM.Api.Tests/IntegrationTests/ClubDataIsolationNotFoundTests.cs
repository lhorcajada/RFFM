#nullable enable
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Players.Commands;
using RFFM.Api.Features.Coaches.Players.Queries;
using RFFM.Api.Features.Coaches.Players.Services;
using RFFM.Api.Features.Coaches.Seasons.Commands;
using RFFM.Api.Features.Coaches.Seasons.Queries;
using RFFM.Api.Features.Coaches.Teams.Commands;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Infrastructure.Services;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Not-found contract for club-scoped handlers (openspec change personal-and-club-spaces, Step 7, requirement
    /// "Another club's data returns not found"). A user who is not a member of the club of a record must get the
    /// domain <see cref="NotFoundException"/> (mapped to 404 by AddCustomProblemDetails), never a plain
    /// KeyNotFoundException (500), and must not modify or delete the record. Real handlers on real PostgreSQL.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubDataIsolationNotFoundTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubDataIsolationNotFoundTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record ClubRecords(Club Club, Season Season, Team Team, Player Player, TeamPlayer TeamPlayer);

        private async Task<ClubRecords> SeedClubRecordsAsync()
        {
            await using var db = _fixture.CreateDbContext();

            var club = Club.Create($"S7 NotFound Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"S7 Season {Guid.NewGuid():N}",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddMonths(9),
                isActive: false,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"S7 NotFound Team {Guid.NewGuid():N}",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var player = Player.Create(new PlayerModelBase
            {
                Name = "S7 Player",
                LastName = "NotFound",
                Alias = $"s7-nf-{Guid.NewGuid():N}",
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = season.Id,
                JoinedDate = DateTime.UtcNow.AddDays(-30),
                FamilyMembers = new()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            return new ClubRecords(club, season, team, player, teamPlayer);
        }

        private async Task<string> NonMemberOfOtherClubAsync()
        {
            // Holds a membership of a different club only, so it is not a member of the record's club.
            var userId = $"s7-outsider-{Guid.NewGuid():N}";
            var otherClub = Club.Create($"S7 Other Club {Guid.NewGuid():N}", SeededCountryId);
            await using var db = _fixture.CreateDbContext();
            db.Clubs.Add(otherClub);
            await db.SaveChangesAsync();
            db.UserClubs.Add(new UserClub(userId, otherClub.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            return userId;
        }

        private static Mock<IAuditLogger> AuditLoggerMock() => new();

        [Fact]
        public async Task DeletePlayer_for_non_member_throws_not_found_and_keeps_player()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new DeletePlayerHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new DeletePlayerCommand { PlayerId = records.Player.Id }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.True(await verifyDb.Players.AnyAsync(p => p.Id == records.Player.Id));
        }

        [Fact]
        public async Task UpdatePlayer_for_non_member_throws_not_found_and_keeps_name()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new UpdateDeletePlayerHandler(db, AuditLoggerMock().Object);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new UpdatePlayerCommand
                    {
                        Id = records.Player.Id,
                        Name = "Leaked",
                        LastName = "Leaked",
                        Alias = records.Player.Alias,
                        ClubId = records.Club.Id
                    }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Players.AsNoTracking().SingleAsync(p => p.Id == records.Player.Id);
            Assert.Equal("S7 Player", stored.Name);
        }

        [Fact]
        public async Task GetPlayer_for_non_member_throws_not_found()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using var db = _fixture.CreateDbContext(userB);
            var handler = new GetPlayer.GetPlayerRequestHandler(db);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new GetPlayer.GetPlayerQuery { PlayerId = records.Player.Id }, CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task GetTeamPlayer_for_non_member_throws_not_found()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using var db = _fixture.CreateDbContext(userB);
            var handler = new GetTeamPlayer.RequestHandler(db);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new GetTeamPlayer.TeamPlayerQuery { TeamPlayerId = records.TeamPlayer.Id }, CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task DeleteSeason_for_non_member_throws_not_found_and_keeps_season()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new DeleteSeasonHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new DeleteSeasonCommand { SeasonId = records.Season.Id }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.True(await verifyDb.Seasons.AnyAsync(s => s.Id == records.Season.Id));
        }

        [Fact]
        public async Task UpdateSeason_for_non_member_throws_not_found_and_keeps_name()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new UpdateDeleteSeasonHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new UpdateSeasonCommand
                    {
                        SeasonId = records.Season.Id,
                        SeasonName = "Leaked",
                        StartDate = DateTime.UtcNow.AddDays(-1),
                        EndDate = DateTime.UtcNow.AddMonths(9),
                        IsActive = true
                    }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Seasons.AsNoTracking().SingleAsync(s => s.Id == records.Season.Id);
            Assert.Equal(records.Season.Name, stored.Name);
        }

        [Fact]
        public async Task GetSeason_for_non_member_throws_not_found()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using var db = _fixture.CreateDbContext(userB);
            var handler = new GetSeason.SeasonsRequestHandler(db);

            await Assert.ThrowsAsync<NotFoundException>(() =>
                handler.Handle(new GetSeason.GetSeasonQuery { SeasonId = records.Season.Id }, CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task AddPlayerToTeam_for_non_member_throws_not_found_and_adds_nothing()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();
            var playerService = new Mock<IPlayerService>();
            playerService
                .Setup(s => s.AddPlayerClub(It.IsAny<CreatePlayerModel>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Player.Create(new PlayerModelBase
                {
                    Name = "Created", LastName = "InMemory", Alias = $"s7-new-{Guid.NewGuid():N}", ClubId = records.Club.Id
                }));

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new AddPlayerTeam.AddPlayerHandler(db, playerService.Object);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new AddPlayerTeam.AddPlayerCommand
                    {
                        TeamId = records.Team.Id,
                        ClubId = records.Club.Id,
                        Name = "Created",
                        LastName = "InMemory",
                        Alias = $"s7-new-{Guid.NewGuid():N}",
                        SeasonId = records.Season.Id
                    }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var count = await verifyDb.TeamPlayers.CountAsync(tp => tp.TeamId == records.Team.Id);
            Assert.Equal(1, count);
        }

        [Fact]
        public async Task DeleteTeam_for_non_member_throws_not_found_and_keeps_team()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new DeleteTeamHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new DeleteTeamCommand { TeamId = records.Team.Id }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            Assert.True(await verifyDb.Teams.AnyAsync(t => t.Id == records.Team.Id));
        }

        [Fact]
        public async Task UpdateTeamCompetition_for_non_member_throws_not_found_and_changes_nothing()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new UpdateTeamCompetitionHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new UpdateTeamCompetitionCommand
                    {
                        Id = records.Team.Id,
                        RffmCompetitionId = 99,
                        RffmGroupId = 98
                    }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Teams.AsNoTracking().SingleAsync(t => t.Id == records.Team.Id);
            Assert.Null(stored.RffmCompetitionId);
        }

        [Fact]
        public async Task UpdateTeam_for_non_member_throws_not_found_and_keeps_name()
        {
            var records = await SeedClubRecordsAsync();
            var userB = await NonMemberOfOtherClubAsync();

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var handler = new UpdateTeamHandler(db);
                await Assert.ThrowsAsync<NotFoundException>(() =>
                    handler.Handle(new UpdateTeamCommand
                    {
                        TeamModel = new TeamModel
                        {
                            Id = records.Team.Id,
                            Name = "Leaked",
                            CategoryId = Category.NationalCategory.Id,
                            ClubId = records.Club.Id,
                            SeasonId = records.Season.Id
                        },
                        UserId = userB
                    }, CancellationToken.None).AsTask());
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.Teams.AsNoTracking().SingleAsync(t => t.Id == records.Team.Id);
            Assert.Equal(records.Team.Name, stored.Name);
        }
    }
}
