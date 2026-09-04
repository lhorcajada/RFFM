#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Kits;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SaveClubKitsHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public SaveClubKitsHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private async Task<string> SeedTeamAsync(AppDbContext db)
        {
            var club = Club.Create($"Save Kits Test Club {Guid.NewGuid():N}", 1);
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
                Name = "Save Kits Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            return team.Id;
        }

        [Fact]
        public async Task Handle_NoExistingKits_CreatesBoth()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveClubKits.Handler(db);
            var command = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = teamId,
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#123456" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#ABCDEF" }
                }
            };

            var result = await handler.Handle(command, CancellationToken.None);

            Assert.Equal(2, result.Length);
            Assert.Single(result.Where(r => r.KitNumber == 1));
            Assert.Single(result.Where(r => r.KitNumber == 2));

            // Verify SocksColor comes from the request, independent of ShortsColor
            Assert.Equal("#123456", result.First(r => r.KitNumber == 1).SocksColor);
            Assert.Equal("#ABCDEF", result.First(r => r.KitNumber == 2).SocksColor);

            // Re-query DB with fresh context
            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.FirstOrDefaultAsync(t => t.Id == teamId);
            Assert.NotNull(team);

            var kits = await verifyDb.ClubKits
                .Where(k => k.ClubId == team.ClubId && k.SeasonId == team.SeasonId)
                .ToListAsync();
            Assert.Equal(2, kits.Count);
        }

        [Fact]
        public async Task Handle_ExistingKits_UpdatesInPlaceWithoutDuplicating()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveClubKits.Handler(db);
            var command1 = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = teamId,
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };

            await handler.Handle(command1, CancellationToken.None);

            // Second call with different colors
            await using var db2 = _fixture.CreateDbContext();
            var handler2 = new SaveClubKits.Handler(db2);
            var command2 = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = teamId,
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#00FF00", ShortsColor = "#00FF00", SocksColor = "#00FF00" },
                    new() { KitNumber = 2, ShirtColor = "#FFFF00", ShortsColor = "#FF00FF", SocksColor = "#FF00FF" }
                }
            };

            var result = await handler2.Handle(command2, CancellationToken.None);

            // Verify the colors changed
            Assert.Equal("#00FF00", result.First(r => r.KitNumber == 1).ShirtColor);
            Assert.Equal("#FFFF00", result.First(r => r.KitNumber == 2).ShirtColor);

            // Verify no duplicates - exactly 2 kits in DB
            await using var verifyDb = _fixture.CreateDbContext();
            var team = await verifyDb.Teams.FirstOrDefaultAsync(t => t.Id == teamId);
            Assert.NotNull(team);

            var kits = await verifyDb.ClubKits
                .Where(k => k.ClubId == team.ClubId && k.SeasonId == team.SeasonId)
                .ToListAsync();
            Assert.Equal(2, kits.Count);
        }

        [Fact]
        public async Task Handle_SocksColorComesFromRequest_IndependentOfShortsColor()
        {
            await using var db = _fixture.CreateDbContext();
            var teamId = await SeedTeamAsync(db);

            var handler = new SaveClubKits.Handler(db);
            var command1 = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = teamId,
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#111111" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#222222" }
                }
            };

            var result1 = await handler.Handle(command1, CancellationToken.None);

            // First save: socks color is whatever the request sent, distinct from shorts
            Assert.Equal("#0000FF", result1.First(r => r.KitNumber == 1).ShortsColor);
            Assert.Equal("#111111", result1.First(r => r.KitNumber == 1).SocksColor);
            Assert.Equal("#FFFFFF", result1.First(r => r.KitNumber == 2).ShortsColor);
            Assert.Equal("#222222", result1.First(r => r.KitNumber == 2).SocksColor);

            // Update with different shorts and socks colors
            await using var db2 = _fixture.CreateDbContext();
            var handler2 = new SaveClubKits.Handler(db2);
            var command2 = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = teamId,
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#00FF00", SocksColor = "#333333" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFF00", SocksColor = "#444444" }
                }
            };

            var result2 = await handler2.Handle(command2, CancellationToken.None);

            // Verify socks color updates independently of shorts color
            Assert.Equal("#00FF00", result2.First(r => r.KitNumber == 1).ShortsColor);
            Assert.Equal("#333333", result2.First(r => r.KitNumber == 1).SocksColor);
            Assert.Equal("#FFFF00", result2.First(r => r.KitNumber == 2).ShortsColor);
            Assert.Equal("#444444", result2.First(r => r.KitNumber == 2).SocksColor);
        }

        [Fact]
        public async Task Handle_TeamDoesNotExist_ThrowsNotFoundException()
        {
            await using var db = _fixture.CreateDbContext();

            var handler = new SaveClubKits.Handler(db);
            var command = new SaveClubKits.SaveClubKitsCommand
            {
                TeamId = "non-existent-team-id",
                Kits = new List<SaveClubKits.SaveClubKitRequest>
                {
                    new() { KitNumber = 1, ShirtColor = "#0000FF", ShortsColor = "#0000FF", SocksColor = "#0000FF" },
                    new() { KitNumber = 2, ShirtColor = "#FF0000", ShortsColor = "#FFFFFF", SocksColor = "#FFFFFF" }
                }
            };

            await Assert.ThrowsAsync<NotFoundException>(
                () => handler.Handle(command, CancellationToken.None).AsTask());
        }
    }
}
