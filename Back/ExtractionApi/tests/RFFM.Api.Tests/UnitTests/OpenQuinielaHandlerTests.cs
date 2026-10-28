#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class OpenQuinielaHandlerTests(PostgresContainerFixture fixture)
    {
        private OpenQuiniela.Handler Handler(RFFM.Api.Infrastructure.Persistence.AppDbContext db, RFFM.Api.Infrastructure.Persistence.FederationDbContext fed, string? userId) =>
            new(db, fed, User(userId), ClockAt(BeforeKickoff));

        [Fact]
        public async Task Handle_OpensTheFirstUnfinishedRoundWithZeroCarryIn()
        {
            var seed = await SeedTeamAsync(fixture);
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o1"));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.CoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None);

            Assert.Equal(roundId, dto.RffmRoundId);
            Assert.Equal(1, dto.RoundNumber);
            Assert.Equal(1m, dto.Price);
            Assert.Equal(0m, dto.CarryIn);
            Assert.Equal("Open", dto.Status);
            Assert.True(await db.QuinielaJornadas.AnyAsync(j => j.Id == dto.Id));
        }

        [Fact]
        public async Task Handle_TakesTheCarryOutOfTheLastSettledJornadaAsCarryIn_AndTheNextRound()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o2a", "1-0", "0-0", "0-1"));
            await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("o2b"));
            var previous = await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await using (var setup = fixture.CreateDbContext())
            {
                var tracked = await setup.QuinielaJornadas.SingleAsync(j => j.Id == previous.Id);
                tracked.Settle(3.25m, AfterMatches);
                await setup.SaveChangesAsync();
            }
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.CoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None);

            Assert.Equal(2, dto.RoundNumber);
            Assert.Equal(3.25m, dto.CarryIn);
        }

        [Fact]
        public async Task Handle_WhenAJornadaIsAlreadyOpen_ThrowsConflict()
        {
            var seed = await SeedTeamAsync(fixture);
            var round1 = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o3a"));
            await SeedRoundAsync(fixture, seed.GroupCode, 2, StandardMatches("o3b"));
            await SeedJornadaAsync(fixture, seed.TeamId, round1);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Handler(db, fed, seed.CoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaAlreadyOpen, ex.Code);
        }

        [Theory]
        [InlineData("player")]
        [InlineData("family")]
        [InlineData("follower")]
        [InlineData("outsider")]
        public async Task Handle_ByANonCoach_ThrowsForbidden(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o4"));
            var userId = who switch { "player" => seed.PlayerId, "family" => seed.FamilyId, "follower" => seed.FollowerId, _ => seed.OutsiderId };
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, userId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None).AsTask());
        }

        [Theory]
        [InlineData("clubcoach")]
        [InlineData("directive")]
        public async Task Handle_ByAClubLevelCoachOrDirective_Opens(string who)
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches($"o7{who}"));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await Handler(db, fed, seed.ClubUser(who)).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None);

            Assert.Equal("Open", dto.Status);
        }

        [Fact]
        public async Task Handle_ByACoachOfAnotherClub_ThrowsForbidden()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o8"));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
                Handler(db, fed, seed.OtherClubCoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task Handle_TeamWithoutLeague_ThrowsConflict()
        {
            var seed = await SeedTeamAsync(fixture, withLeague: false);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<ConflictException>(() =>
                Handler(db, fed, seed.CoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaTeamWithoutLeague, ex.Code);
        }

        [Fact]
        public async Task Handle_WithoutAnUnfinishedRound_ThrowsNotFound()
        {
            var seed = await SeedTeamAsync(fixture);
            await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches("o6", "1-0", "0-0", "0-1"));
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
                Handler(db, fed, seed.CoachId).Handle(new OpenQuiniela.Command(seed.TeamId), CancellationToken.None).AsTask());

            Assert.Equal(ErrorCodes.QuinielaNoNextRound, ex.Code);
        }

        [Fact]
        public void Validator_RequiresTeamId() =>
            Assert.False(new OpenQuiniela.Validator().Validate(new OpenQuiniela.Command("")).IsValid);
    }
}
