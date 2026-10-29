#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Models;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Teams.Commands.CreateTeamsBatch;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class CreateTeamsBatchHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public CreateTeamsBatchHandlerTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static CreateTeamsBatchCommand Command(string clubId, string seasonId, int categoryId, int? leagueId, params string[] letters) =>
            new(new CreateTeamsBatchRequest(clubId, seasonId, categoryId, leagueId, letters));

        [Fact]
        public async Task Creates_one_team_per_letter_named_after_the_category()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, clubId, seasonId) = await SeedTeamAsync(db);
            var category = Category.U10;

            var result = await new Handler(db).Handle(Command(clubId, seasonId, category.Id, null, "a", "B"), CancellationToken.None);

            Assert.Equal(new[] { $"{category.Name} A", $"{category.Name} B" }, result.Created.Select(c => c.Name));
            Assert.Empty(result.Skipped);
            var stored = await db.Teams.AsNoTracking().Where(t => t.ClubId == clubId && t.CategoryId == category.Id).ToListAsync();
            Assert.Equal(2, stored.Count);
            Assert.All(stored, t => Assert.Null(t.UrlPhoto));
        }

        [Fact]
        public async Task Skips_existing_names_ignoring_case_and_spaces()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, clubId, seasonId) = await SeedTeamAsync(db);
            var category = Category.U12;
            db.Teams.Add(new Team(new TeamModelBase { Name = $"  {category.Name.ToUpperInvariant()} a ", CategoryId = category.Id, ClubId = clubId, SeasonId = seasonId }));
            await db.SaveChangesAsync();

            var result = await new Handler(db).Handle(Command(clubId, seasonId, category.Id, null, "A", "B"), CancellationToken.None);

            Assert.Equal(new[] { $"{category.Name} B" }, result.Created.Select(c => c.Name));
            Assert.Equal(new[] { $"{category.Name} A" }, result.Skipped);
        }

        [Fact]
        public async Task Everything_skipped_returns_empty_created()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, clubId, seasonId) = await SeedTeamAsync(db);
            var category = Category.U08;
            db.Teams.Add(new Team(new TeamModelBase { Name = $"{category.Name} A", CategoryId = category.Id, ClubId = clubId, SeasonId = seasonId }));
            await db.SaveChangesAsync();

            var result = await new Handler(db).Handle(Command(clubId, seasonId, category.Id, null, "A"), CancellationToken.None);

            Assert.Empty(result.Created);
            Assert.Single(result.Skipped);
        }

        [Fact]
        public async Task Unknown_category_throws_domain_exception()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, clubId, seasonId) = await SeedTeamAsync(db);

            await Assert.ThrowsAsync<DomainException>(() =>
                new Handler(db).Handle(Command(clubId, seasonId, 9999, null, "A"), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Same_names_in_another_club_are_not_skipped()
        {
            await using var db = _fixture.CreateDbContext();
            var (_, clubId, seasonId) = await SeedTeamAsync(db);
            var (_, otherClubId, otherSeasonId) = await SeedTeamAsync(db);
            var category = Category.U06;
            db.Teams.Add(new Team(new TeamModelBase { Name = $"{category.Name} A", CategoryId = category.Id, ClubId = otherClubId, SeasonId = otherSeasonId }));
            await db.SaveChangesAsync();

            var result = await new Handler(db).Handle(Command(clubId, seasonId, category.Id, null, "A"), CancellationToken.None);

            Assert.Single(result.Created);
            Assert.Empty(result.Skipped);
        }
    }
}
