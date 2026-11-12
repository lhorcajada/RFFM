#nullable enable
using RFFM.Api.Domain;
using RFFM.Api.Features.Coaches.DeconvocationRules;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class DeconvocationRulesHandlerTests(PostgresContainerFixture fixture)
    {
        private static DeconvocationRuleDto Rule(string condition, string text = "Texto", double points = 2) =>
            new(condition, text, new Dictionary<string, double> { ["perGoal"] = points }, new Dictionary<string, double>());

        private static GetDeconvocationRules.Handler GetHandler(AppDbContext db, string? userId) => new(db, User(userId));
        private static UpdateDeconvocationRules.Handler UpdateHandler(AppDbContext db, string? userId) => new(db, User(userId));
        private static ResetDeconvocationRules.Handler ResetHandler(AppDbContext db, string? userId) => new(db, User(userId));

        [Fact]
        public async Task Get_WithoutSavedRules_ReturnsDefault()
        {
            var seed = await SeedTeamAsync(fixture);
            await using var db = fixture.CreateDbContext();

            var dto = await GetHandler(db, seed.CoachId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None);

            Assert.True(dto.IsDefault);
            Assert.Null(dto.Rules);
        }

        [Fact]
        public async Task Update_StoresTheRules_AndGetReturnsThem()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(
                    new UpdateDeconvocationRules.Command(seed.TeamId, [Rule("goals", "Mis goles", 3)]), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, seed.CoachId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None);

            Assert.False(dto.IsDefault);
            var rule = Assert.Single(dto.Rules!);
            Assert.Equal("Mis goles", rule.Text);
            Assert.Equal(3, rule.Points["perGoal"]);
        }

        [Fact]
        public async Task Update_ASecondTime_ReplacesTheRulesInTheSameRow()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateDeconvocationRules.Command(seed.TeamId, [Rule("goals")]), CancellationToken.None);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateDeconvocationRules.Command(seed.TeamId, [Rule("streak")]), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, seed.CoachId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None);
            Assert.Equal("streak", Assert.Single(dto.Rules!).Condition);
        }

        [Fact]
        public async Task Update_AnEmptyList_IsStoredAsAnEmptyConfiguration()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateDeconvocationRules.Command(seed.TeamId, []), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, seed.CoachId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None);
            Assert.False(dto.IsDefault);
            Assert.Empty(dto.Rules!);
        }

        [Fact]
        public async Task Rules_AreNotSharedBetweenTeams()
        {
            var a = await SeedTeamAsync(fixture);
            var b = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, a.CoachId).Handle(new UpdateDeconvocationRules.Command(a.TeamId, [Rule("goals")]), CancellationToken.None);

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, b.CoachId).Handle(new GetDeconvocationRules.Query(b.TeamId), CancellationToken.None);
            Assert.True(dto.IsDefault);
        }

        [Fact]
        public async Task Reset_DeletesTheSavedRules_AndIsIdempotent()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
                await UpdateHandler(db, seed.CoachId).Handle(new UpdateDeconvocationRules.Command(seed.TeamId, [Rule("goals")]), CancellationToken.None);
            await using (var db = fixture.CreateDbContext())
            {
                await ResetHandler(db, seed.CoachId).Handle(new ResetDeconvocationRules.Command(seed.TeamId), CancellationToken.None);
                await ResetHandler(db, seed.CoachId).Handle(new ResetDeconvocationRules.Command(seed.TeamId), CancellationToken.None);
            }

            await using var verify = fixture.CreateDbContext();
            var dto = await GetHandler(verify, seed.CoachId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None);
            Assert.True(dto.IsDefault);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        public async Task AllOperations_ByANonCoach_ThrowForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, _ => seed.FollowerId };
            await using var db = fixture.CreateDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                GetHandler(db, userId).Handle(new GetDeconvocationRules.Query(seed.TeamId), CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                UpdateHandler(db, userId).Handle(new UpdateDeconvocationRules.Command(seed.TeamId, [Rule("goals")]), CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                ResetHandler(db, userId).Handle(new ResetDeconvocationRules.Command(seed.TeamId), CancellationToken.None).AsTask());
        }

        private static readonly UpdateDeconvocationRules.Validator Validator = new();

        private static bool IsValid(params DeconvocationRuleDto[] rules) =>
            Validator.Validate(new UpdateDeconvocationRules.Command("t", rules)).IsValid;

        [Fact]
        public void Validator_AcceptsKnownConditions() => Assert.True(IsValid(Rule("goals"), Rule("streak")));

        [Fact]
        public void Validator_RejectsAnUnknownCondition() => Assert.False(IsValid(Rule("nope")));

        [Fact]
        public void Validator_RejectsARepeatedCondition() => Assert.False(IsValid(Rule("goals"), Rule("goals")));

        [Fact]
        public void Validator_RejectsAnEmptyText() => Assert.False(IsValid(Rule("goals", " ")));

        [Fact]
        public void Validator_RejectsATextOver200Chars() => Assert.False(IsValid(Rule("goals", new string('a', 201))));

        [Theory]
        [InlineData(1000.01)]
        [InlineData(-1000.01)]
        [InlineData(double.NaN)]
        [InlineData(double.PositiveInfinity)]
        public void Validator_RejectsPointsOutOfRange(double points) => Assert.False(IsValid(Rule("goals", "t", points)));

        [Fact]
        public void Validator_RejectsMoreThan20Rules() =>
            Assert.False(IsValid(Enumerable.Range(0, 21).Select(_ => Rule("goals")).ToArray()));
    }
}
