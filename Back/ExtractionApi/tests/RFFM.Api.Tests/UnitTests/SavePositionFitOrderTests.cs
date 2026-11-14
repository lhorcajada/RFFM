#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Services;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Features.Coaches.Players.Commands.SavePositionFitOrder;
using static RFFM.Api.Tests.UnitTests.AvailabilityTestSupport;
using static RFFM.Api.Tests.UnitTests.PositionFitTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    public class SavePositionFitOrderValidatorTests
    {
        private static bool IsValid(string teamId, string position, params string[] ids) =>
            new Validator().Validate(new SavePositionFitOrderCommand(teamId, position, new SavePositionFitOrderRequest(ids))).IsValid;

        [Fact]
        public void Valid_order_passes() => Assert.True(IsValid("team-1", "defensiveMidfielder", "a", "b"));

        [Fact]
        public void Empty_team_id_fails() => Assert.False(IsValid("", "defensiveMidfielder", "a"));

        [Fact]
        public void Empty_order_fails() => Assert.False(IsValid("team-1", "defensiveMidfielder"));

        [Fact]
        public void Repeated_player_fails() => Assert.False(IsValid("team-1", "defensiveMidfielder", "a", "a"));

        [Fact]
        public void Unknown_position_fails() => Assert.False(IsValid("team-1", "libero", "a"));

        [Fact]
        public void Goalkeeper_position_fails() => Assert.False(IsValid("team-1", "goalkeeper", "a"));
    }

    [Collection(PostgresCollection.Name)]
    public class SavePositionFitOrderTests
    {
        private const int Mcd = 7;
        private const int McdPositionId = 4;

        private readonly PostgresContainerFixture _fixture;

        public SavePositionFitOrderTests(PostgresContainerFixture fixture) => _fixture = fixture;

        private static Handler CreateHandler(AppDbContext db, ICurrentUserService user) => new(db, user);

        private static SavePositionFitOrderCommand Command(string teamId, params string[] ids) =>
            new(teamId, "defensiveMidfielder", new SavePositionFitOrderRequest(ids));

        private static Dictionary<string, int> Levels(int value) => new() { ["traitCoverage"] = value, ["traitRoleDiscipline"] = value };

        [Fact]
        public async Task Stores_the_order_of_the_current_week_and_flags_a_manual_correction()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var strong = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "strong", Mcd, levels: Levels(5));
            var weak = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "weak", Mcd, levels: Levels(1));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(Command(teamId, weak, strong), CancellationToken.None);

            Assert.Equal(new[] { weak, strong }, result.Candidates.Select(c => c.TeamPlayerId));
            Assert.True(result.IsManual);
            var stored = await db.TeamPositionFitOrders.AsNoTracking().Include(o => o.Entries).SingleAsync(o => o.TeamId == teamId);
            Assert.Equal(McdPositionId, stored.Position);
            Assert.Equal(DayOfWeek.Monday, stored.WeekStart.DayOfWeek);
            Assert.Equal(new[] { weak, strong }, stored.Entries.OrderBy(e => e.Place).Select(e => e.TeamPlayerId));
        }

        [Fact]
        public async Task Order_equal_to_the_proposed_one_is_not_manual()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var strong = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "strong", Mcd, levels: Levels(5));
            var weak = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "weak", Mcd, levels: Levels(1));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var result = await CreateHandler(db, coach).Handle(Command(teamId, strong, weak), CancellationToken.None);

            Assert.False(result.IsManual);
        }

        [Fact]
        public async Task Saving_again_in_the_same_week_replaces_the_order()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var a = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "a", Mcd, levels: Levels(5));
            var b = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "b", Mcd, levels: Levels(1));
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");
            var handler = CreateHandler(db, coach);
            await handler.Handle(Command(teamId, b, a), CancellationToken.None);

            await handler.Handle(Command(teamId, a, b), CancellationToken.None);

            var stored = await db.TeamPositionFitOrders.AsNoTracking().Include(o => o.Entries).SingleAsync(o => o.TeamId == teamId);
            Assert.Equal(new[] { a, b }, stored.Entries.OrderBy(e => e.Place).Select(e => e.TeamPlayerId));
        }

        [Fact]
        public async Task Player_that_is_not_a_candidate_of_the_position_is_rejected_and_nothing_is_stored()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var midfielder = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "mcd", Mcd);
            var forward = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "dc", 11);
            var coach = CurrentUser(await SeedCoachAsync(db, teamId), "Coach");

            var exception = await Assert.ThrowsAsync<DomainException>(() =>
                CreateHandler(db, coach).Handle(Command(teamId, midfielder, forward), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.PositionFitPlayerNotCandidate, exception.Code);
            Assert.False(await db.TeamPositionFitOrders.AnyAsync(o => o.TeamId == teamId));
        }

        [Fact]
        public async Task Coach_of_another_team_is_forbidden()
        {
            await using var db = _fixture.CreateDbContext();
            var (teamId, clubId, seasonId) = await SeedTeamAsync(db);
            var player = await SeedFieldPlayerAsync(db, teamId, clubId, seasonId, "mcd", Mcd);
            var (otherTeamId, _, _) = await SeedTeamAsync(db);
            var outsider = CurrentUser(await SeedCoachAsync(db, otherTeamId), "Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                CreateHandler(db, outsider).Handle(Command(teamId, player), CancellationToken.None).AsTask());

            Assert.False(await db.TeamPositionFitOrders.AnyAsync(o => o.TeamId == teamId));
        }

        [Fact]
        public async Task Unknown_team_is_not_found()
        {
            await using var db = _fixture.CreateDbContext();

            await Assert.ThrowsAsync<NotFoundException>(() =>
                CreateHandler(db, CurrentUser(Guid.NewGuid().ToString(), "Coach"))
                    .Handle(Command(Guid.NewGuid().ToString(), "x"), CancellationToken.None).AsTask());
        }
    }
}
