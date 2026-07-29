#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Teams.Queries.GetTeams;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class GetTeamsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public GetTeamsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static async Task<(Club Club, Season Season, string TeamId)> SeedClubWithTeamAsync(AppDbContext db, string namePrefix)
        {
            var club = Club.Create($"{namePrefix} Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"{namePrefix} Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return (club, season, team.Id);
        }

        [Fact]
        public async Task Handle_UserIsCoachOfTeam_CanEditTrueForThatTeam()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, _, teamId) = await SeedClubWithTeamAsync(db, "CoachTeams");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            db.UserTeams.Add(new UserTeam(userId, teamId, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.True(result.Single(t => t.Id == teamId).CanEdit);
        }

        [Fact]
        public async Task Handle_UserIsClubLevelCoach_CanEditTrueForAllClubTeams()
        {
            // Real-world coach role: CreateClub assigns the creator UserClub.RoleId == Coach
            // (club-level), not a per-team UserTeam row.
            await using var db = _fixture.CreateDbContext();
            var (club, season, teamId) = await SeedClubWithTeamAsync(db, "ClubLevelCoachTeams");
            var secondTeam = new Team(new TeamModelBase
            {
                Name = "Second Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(secondTeam);
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.All(result, t => Assert.True(t.CanEdit));
        }

        [Fact]
        public async Task Handle_UserIsDirectiveOfClub_CanEditTrueForAllClubTeams()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, season, teamId) = await SeedClubWithTeamAsync(db, "DirectiveTeams");
            var secondTeam = new Team(new TeamModelBase
            {
                Name = "Second Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(secondTeam);
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.Directive.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.All(result, t => Assert.True(t.CanEdit));
        }

        [Fact]
        public async Task Handle_UserUnrelatedRole_CanEditFalse()
        {
            await using var db = _fixture.CreateDbContext();
            var (club, _, teamId) = await SeedClubWithTeamAsync(db, "MemberTeams");
            var userId = Guid.NewGuid().ToString();
            db.UserClubs.Add(new UserClub(userId, club.Id, Membership.ClubMember.Id));
            await db.SaveChangesAsync();
            var handler = new TeamsRequestHandler(db);

            var result = await handler.Handle(new TeamsQuery(club.Id, userId), CancellationToken.None);

            Assert.False(result.Single(t => t.Id == teamId).CanEdit);
        }
    }
}
