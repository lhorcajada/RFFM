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
using RFFM.Api.Features.Coaches.DeconvocationProposals;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class SavedDeconvocationProposalsTests(PostgresContainerFixture fixture)
    {
        private sealed record Seed(string EventId, Team Team, List<string> PlayerIds);

        private static async Task<Seed> SeedAsync(AppDbContext db, int players = 3)
        {
            var club = Club.Create($"Proposal Test Club {Guid.NewGuid():N}", 1);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create($"Season {Guid.NewGuid():N}", DateTime.UtcNow, DateTime.UtcNow.AddMonths(9), isActive: true, club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = "Proposal Test Team",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var eventDate = DateTime.UtcNow.AddDays(3);
            var sportEvent = SportEvent.CreateNew(
                "Partido vs Rival CF", eventDate, eventDate, null, null, null, null, 1, team.Id, null);
            db.SportEvents.Add(sportEvent);
            await db.SaveChangesAsync();

            var playerIds = new List<string>();
            for (var i = 0; i < players; i++)
            {
                var player = Player.Create(new PlayerModelBase
                {
                    Name = "Test", LastName = "Player", Alias = $"proposal-{Guid.NewGuid():N}", ClubId = team.ClubId
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
                playerIds.Add(teamPlayer.Id);
            }

            return new Seed(sportEvent.Id, team, playerIds);
        }

        private async Task<Seed> SeedAsync(int players = 3)
        {
            await using var db = fixture.CreateDbContext();
            return await SeedAsync(db, players);
        }

        private static ICurrentUserService User(string role)
        {
            var mock = new Mock<ICurrentUserService>();
            mock.Setup(c => c.UserId).Returns(Guid.NewGuid().ToString());
            mock.Setup(c => c.IsAuthenticated).Returns(true);
            mock.Setup(c => c.Roles).Returns([role]);
            return mock.Object;
        }

        private static ICurrentUserService Admin() => User("Administrator");

        private async Task<SavedDeconvocationProposalDto> SaveAsync(string eventId, string name, params string[] playerIds)
        {
            await using var db = fixture.CreateDbContext();
            return await new SaveDeconvocationProposal.Handler(db, Admin()).Handle(
                new SaveDeconvocationProposal.Command(eventId, name, playerIds), CancellationToken.None);
        }

        private async Task<IReadOnlyList<SavedDeconvocationProposalDto>> ListAsync(string eventId)
        {
            await using var db = fixture.CreateDbContext();
            return (await new GetSavedDeconvocationProposals.Handler(db, Admin()).Handle(
                new GetSavedDeconvocationProposals.Query(eventId), CancellationToken.None)).Items;
        }

        private async Task DeleteAsync(string eventId, string proposalId)
        {
            await using var db = fixture.CreateDbContext();
            await new DeleteSavedDeconvocationProposal.Handler(db, Admin()).Handle(
                new DeleteSavedDeconvocationProposal.Command(eventId, proposalId), CancellationToken.None);
        }

        [Fact]
        public async Task Save_SeveralProposals_ListsThemOldestFirstKeepingTheOrderOfThePlayers()
        {
            var seed = await SeedAsync();

            await SaveAsync(seed.EventId, "  Primera  ", seed.PlayerIds[2], seed.PlayerIds[0]);
            await SaveAsync(seed.EventId, "Segunda", seed.PlayerIds[1]);

            var list = await ListAsync(seed.EventId);
            Assert.Equal(["Primera", "Segunda"], list.Select(p => p.Name));
            Assert.Equal([seed.PlayerIds[2], seed.PlayerIds[0]], list[0].TeamPlayerIds);
        }

        [Fact]
        public async Task Save_DoesNotChangeTheConvocation()
        {
            var seed = await SeedAsync();

            await SaveAsync(seed.EventId, "Primera", seed.PlayerIds[0]);

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.Convocations.AnyAsync(c => c.SportEventId == seed.EventId));
        }

        [Fact]
        public async Task Save_TheEleventhProposal_ThrowsConflict()
        {
            var seed = await SeedAsync(1);
            for (var i = 1; i <= 10; i++)
                await SaveAsync(seed.EventId, $"Propuesta {i}", seed.PlayerIds[0]);

            var error = await Assert.ThrowsAsync<ConflictException>(() => SaveAsync(seed.EventId, "Una más", seed.PlayerIds[0]));

            Assert.Equal(ErrorCodes.DeconvocationProposalLimitReached, error.Code);
            Assert.Equal(10, (await ListAsync(seed.EventId)).Count);
        }

        [Fact]
        public async Task Save_APlayerOfAnotherTeam_IsRejectedAndNothingIsStored()
        {
            var seed = await SeedAsync(1);
            var other = await SeedAsync(1);

            var error = await Assert.ThrowsAsync<DomainException>(
                () => SaveAsync(seed.EventId, "Mala", seed.PlayerIds[0], other.PlayerIds[0]));

            Assert.Equal(ErrorCodes.DeconvocationProposalPlayerNotInTeam, error.Code);
            Assert.Empty(await ListAsync(seed.EventId));
        }

        [Theory]
        [InlineData("", new[] { "a" })]
        [InlineData("   ", new[] { "a" })]
        [InlineData("1234567890123456789012345678901234567890123456789012345678901", new[] { "a" })]
        [InlineData("Sin jugadores", new string[0])]
        [InlineData("Repetidos", new[] { "a", "a" })]
        [InlineData("Id en blanco", new[] { "" })]
        public void Validator_RejectsInvalidProposals(string name, string[] playerIds)
        {
            var result = new SaveDeconvocationProposal.Validator()
                .Validate(new SaveDeconvocationProposal.Command("event", name, playerIds));

            Assert.False(result.IsValid);
        }

        [Fact]
        public void Validator_AcceptsAValidProposal()
        {
            var result = new SaveDeconvocationProposal.Validator()
                .Validate(new SaveDeconvocationProposal.Command("event", "Propuesta 1", ["a", "b"]));

            Assert.True(result.IsValid);
        }

        [Fact]
        public async Task Delete_RemovesOnlyThatProposal()
        {
            var seed = await SeedAsync();
            var first = await SaveAsync(seed.EventId, "Primera", seed.PlayerIds[0]);
            await SaveAsync(seed.EventId, "Segunda", seed.PlayerIds[1]);

            await DeleteAsync(seed.EventId, first.Id);

            Assert.Equal("Segunda", Assert.Single(await ListAsync(seed.EventId)).Name);
        }

        [Fact]
        public async Task Delete_AProposalOfAnotherMatch_ThrowsNotFoundAndKeepsIt()
        {
            var seed = await SeedAsync(1);
            var other = await SeedAsync(1);
            var saved = await SaveAsync(seed.EventId, "Primera", seed.PlayerIds[0]);

            await Assert.ThrowsAsync<NotFoundException>(() => DeleteAsync(other.EventId, saved.Id));

            Assert.Single(await ListAsync(seed.EventId));
        }

        [Fact]
        public async Task ACoachOutsideTheTeam_CannotReadSaveOrDelete()
        {
            var seed = await SeedAsync(1);
            var saved = await SaveAsync(seed.EventId, "Primera", seed.PlayerIds[0]);
            await using var db = fixture.CreateDbContext();
            var outsider = User("Coach");

            await Assert.ThrowsAsync<ForbiddenAccessException>(() => new GetSavedDeconvocationProposals.Handler(db, outsider)
                .Handle(new GetSavedDeconvocationProposals.Query(seed.EventId), CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => new SaveDeconvocationProposal.Handler(db, outsider)
                .Handle(new SaveDeconvocationProposal.Command(seed.EventId, "Otra", seed.PlayerIds), CancellationToken.None).AsTask());
            await Assert.ThrowsAsync<ForbiddenAccessException>(() => new DeleteSavedDeconvocationProposal.Handler(db, outsider)
                .Handle(new DeleteSavedDeconvocationProposal.Command(seed.EventId, saved.Id), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task List_OfAnUnknownMatch_ThrowsNotFound()
        {
            await Assert.ThrowsAsync<NotFoundException>(() => ListAsync("missing-event"));
        }

        [Fact]
        public async Task DeletingTheMatch_DeletesItsProposals()
        {
            var seed = await SeedAsync(1);
            var saved = await SaveAsync(seed.EventId, "Primera", seed.PlayerIds[0]);

            await using (var db = fixture.CreateDbContext())
                await db.SportEvents.Where(e => e.Id == seed.EventId).ExecuteDeleteAsync();

            await using var verify = fixture.CreateDbContext();
            Assert.False(await verify.DeconvocationSavedProposals.AnyAsync(p => p.Id == saved.Id));
        }
    }
}
