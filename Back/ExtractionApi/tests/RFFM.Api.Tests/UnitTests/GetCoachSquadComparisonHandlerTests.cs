#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using RffmPlayer = RFFM.Api.Features.Federation.Players.Models.Player;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetCoachSquadComparisonHandlerTests
    {
        private const string TeamCode = "123456";
        private const int RffmSeason = 22;
        private const int SeasonStartYear = 2026;
        private readonly PostgresContainerFixture _fixture;
        private readonly Mock<ITeamService> _teamService = new();

        public GetCoachSquadComparisonHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
            _teamService
                .Setup(s => s.GetStaticsTeamPlayers(It.IsAny<GetAgeSummary.AgesQueryApp>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((
                    new (TeamPlayerRffm, RffmPlayer?)[]
                    {
                        (new TeamPlayerRffm { PlayerCode = "r1", Name = "PEREZ GARCIA, JOSE" },
                            new RffmPlayer { PlayerId = "r1", Name = "PEREZ GARCIA, JOSE", BirthYear = 2012, JerseyNumber = "5", PhotoUrl = "rffm.jpg",
                                Matches = new RFFM.Api.Features.Federation.Players.Models.MatchStatistics { TotalGoals = 3, Called = 8 }, Cards = new RFFM.Api.Features.Federation.Players.Models.CardStatistics { Yellow = 1 } }),
                        (new TeamPlayerRffm { PlayerCode = "r2", Name = "RUIZ, ANA" }, null)
                    },
                    Array.Empty<GetAgeSummary.AgeCount>()));
        }

        private async Task<GetCoachSquadComparison.CoachSquadComparisonResponse> HandleAsync(
            AppDbContext db, string userId, int competitionId, int groupId, int season = RffmSeason,
            string requestedTeamCode = TeamCode, string? savedTeamCode = TeamCode)
        {
            await using var federationDb = _fixture.CreateFederationDbContext();
            if (savedTeamCode != null)
            {
                federationDb.FederationSettings.Add(new FederationSetting(userId, competitionId.ToString(),
                    groupId: groupId.ToString(), teamId: savedTeamCode, isPrimary: true, seasonId: season));
                await federationDb.SaveChangesAsync();
            }

            var handler = new GetCoachSquadComparison.Handler(db, federationDb, _teamService.Object, Options.Create(new RffmOptions()));
            return await handler.Handle(
                new GetCoachSquadComparison.QueryApp(userId, requestedTeamCode, season, competitionId, groupId),
                CancellationToken.None);
        }

        private static int NewRffmId() => Random.Shared.Next(1_000_000, int.MaxValue);

        private static async Task<(Club Club, Team Team, string SeasonId)> SeedTeamAsync(
            AppDbContext db, int competitionId, int groupId, int startYear = SeasonStartYear, string name = "Infantil A")
        {
            var club = Club.Create($"CD Comparación {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var start = new DateTime(startYear, 8, 1, 0, 0, 0, DateTimeKind.Utc);
            var season = Season.Create($"Season {Guid.NewGuid():N}", start, start.AddMonths(10), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = name,
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id,
                RffmCompetitionId = competitionId,
                RffmGroupId = groupId
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();
            return (club, team, season.Id);
        }

        private static async Task SeedPlayerAsync(AppDbContext db, Club club, Team team, string seasonId,
            string name, string lastName, int dorsal, DateTime? leftDate = null)
        {
            var player = Player.Create(new PlayerModelBase
            {
                Name = name,
                LastName = lastName,
                Alias = $"{name}-{Guid.NewGuid():N}",
                BirthDate = new DateTime(2012, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                ClubId = club.Id
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = seasonId,
                JoinedDate = DateTime.UtcNow.AddMonths(-2),
                FamilyMembers = new List<FamilyModel>()
            });
            teamPlayer.SetDorsal(dorsal);
            if (leftDate != null)
                teamPlayer.SetLeftDate(leftDate);
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Handle_ShouldCompareSquads_WhenExactlyOneCoachedTeamMatches()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (club, team, seasonId) = await SeedTeamAsync(db, competitionId, groupId);
            await SeedPlayerAsync(db, club, team, seasonId, "José", "Pérez", 10);
            await SeedPlayerAsync(db, club, team, seasonId, "Mario", "Gómez", 4);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.True(result.IsCoachTeam);
            Assert.Equal(team.Id, result.TeamId);
            Assert.Equal("Infantil A", result.TeamName);
            Assert.Equal(ComparedPlayerStatus.Licensed, result.Players.Single(p => p.Name == "José Pérez").Status);
            Assert.Equal("10", result.Players.Single(p => p.Name == "José Pérez").JerseyNumber);
            Assert.Equal(3, result.Players.Single(p => p.Name == "José Pérez").Stats!.Goals);
            Assert.Equal(1, result.Players.Single(p => p.Name == "José Pérez").Stats!.Yellow);
            Assert.Equal(ComparedPlayerStatus.Unlicensed, result.Players.Single(p => p.Name == "Mario Gómez").Status);
            Assert.Equal(ComparedPlayerStatus.NotInTeam, result.Players.Single(p => p.Name == "RUIZ, ANA").Status);
        }

        [Theory]
        [InlineData(2)]
        [InlineData(1)]
        public async Task Handle_ShouldBeCoachTeam_WhenUserManagesTheClubWithoutTeamMembership(int clubRoleId)
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (club, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserClubs.Add(new UserClub(userId, club.Id, clubRoleId));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.True(result.IsCoachTeam);
            Assert.Equal(team.Id, result.TeamId);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenUserIsOnlyClubMember()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (club, _, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.False(result.IsCoachTeam);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeamNorCallRffm_WhenRequestedRffmTeamIsAnotherTeamOfTheGroup()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId, requestedTeamCode: "999999");

            Assert.False(result.IsCoachTeam);
            _teamService.Verify(s => s.GetStaticsTeamPlayers(It.IsAny<GetAgeSummary.AgesQueryApp>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenUserHasNotSavedTheRffmTeam()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId, savedTeamCode: null);

            Assert.False(result.IsCoachTeam);
        }

        [Fact]
        public async Task Handle_ShouldExcludePlayersWhoLeftTheTeam()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (club, team, seasonId) = await SeedTeamAsync(db, competitionId, groupId);
            await SeedPlayerAsync(db, club, team, seasonId, "Mario", "Gómez", 4, leftDate: DateTime.UtcNow.AddDays(-1));
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.DoesNotContain(result.Players, p => p.Name == "Mario Gómez");
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeamNorCallRffm_WhenNoCoachedTeamMatches()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, NewRffmId());

            Assert.False(result.IsCoachTeam);
            Assert.Empty(result.Players);
            _teamService.Verify(s => s.GetStaticsTeamPlayers(It.IsAny<GetAgeSummary.AgesQueryApp>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenTwoCoachedTeamsShareTheGroup()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, teamA, _) = await SeedTeamAsync(db, competitionId, groupId, name: "Infantil A");
            var (_, teamB, _) = await SeedTeamAsync(db, competitionId, groupId, name: "Infantil B");
            db.UserTeams.Add(new UserTeam(userId, teamA.Id, Membership.Coach.Id));
            db.UserTeams.Add(new UserTeam(userId, teamB.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.False(result.IsCoachTeam);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenUserIsNotCoachOfTheTeam()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.False(result.IsCoachTeam);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenTeamSeasonIsAnotherYear()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId, startYear: 2025);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId);

            Assert.False(result.IsCoachTeam);
        }

        [Fact]
        public async Task Handle_ShouldNotBeCoachTeam_WhenSeasonIsNotConfigured()
        {
            var userId = Guid.NewGuid().ToString();
            var (competitionId, groupId) = (NewRffmId(), NewRffmId());
            await using var db = _fixture.CreateDbContext();
            var (_, team, _) = await SeedTeamAsync(db, competitionId, groupId);
            db.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();

            var result = await HandleAsync(db, userId, competitionId, groupId, season: 99);

            Assert.False(result.IsCoachTeam);
        }
    }
}
