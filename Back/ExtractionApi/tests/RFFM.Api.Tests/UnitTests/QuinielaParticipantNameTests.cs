#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.Teams;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Quiniela;
using RFFM.Api.Tests.Fixtures;
using Xunit;
using static RFFM.Api.Tests.UnitTests.QuinielaTestSupport;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class QuinielaParticipantNameTests(PostgresContainerFixture fixture)
    {
        private async Task<string> PaymentsNameOfAsync(QuinielaSeed seed, string userId, string suffix)
        {
            var roundId = await SeedRoundAsync(fixture, seed.GroupCode, 1, StandardMatches(suffix));
            var jornada = await SeedJornadaAsync(fixture, seed.TeamId, roundId);
            await SeedTicketAsync(fixture, jornada.Id, userId, suffix, QuinielaSign.Home, QuinielaSign.Draw, QuinielaSign.Away);
            await using var db = fixture.CreateDbContext();
            await using var fed = fixture.CreateFederationDbContext();

            var dto = await new GetQuinielaPayments.Handler(db, fed, User(seed.CoachId), ClockAt(BeforeKickoff))
                .Handle(new GetQuinielaPayments.Query(seed.TeamId, jornada.Id), CancellationToken.None);

            return Assert.Single(dto.Tickets).UserName;
        }

        private async Task LinkFamilyMemberAsync(QuinielaSeed seed, string userId, string name, string lastName)
        {
            await using var db = fixture.CreateDbContext();
            var team = await db.Teams.SingleAsync(t => t.Id == seed.TeamId);
            var player = Player.Create(new PlayerModelBase
            {
                Name = "Hijo",
                LastName = "Jugador",
                Alias = $"quiniela-name-{Guid.NewGuid():N}",
                ClubId = team.ClubId
            });
            db.Players.Add(player);
            await db.SaveChangesAsync();

            var teamPlayer = TeamPlayer.Create(new TeamPlayerModel
            {
                PlayerId = player.Id,
                TeamId = team.Id,
                SeasonId = team.SeasonId,
                JoinedDate = DateTime.UtcNow,
                FamilyMembers = new List<FamilyModel>()
            });
            db.TeamPlayers.Add(teamPlayer);
            await db.SaveChangesAsync();

            var family = TeamPlayerFamilyMember.Create(teamPlayer.Id, name, lastName, null, null, null, "Mother");
            db.TeamPlayerFamilyMembers.Add(family);
            await db.SaveChangesAsync();
            family.LinkAccount(userId);
            await db.SaveChangesAsync();
        }

        [Fact]
        public async Task Payments_UsesThePersonalDataName_WhenTheUserHasIt()
        {
            var seed = await SeedTeamAsync(fixture);
            await using (var db = fixture.CreateDbContext())
            {
                db.UserPersonalData.Add(UserPersonalData.Create(seed.FamilyId, "Marta", "Gil", null, null));
                await db.SaveChangesAsync();
            }

            Assert.Equal("Marta Gil", await PaymentsNameOfAsync(seed, seed.FamilyId, "n1"));
        }

        [Fact]
        public async Task Payments_FallsBackToTheLinkedFamilyMemberName_WhenThereIsNoPersonalData()
        {
            var seed = await SeedTeamAsync(fixture);
            await LinkFamilyMemberAsync(seed, seed.FamilyId, "Jane", "Doe");

            Assert.Equal("Jane Doe", await PaymentsNameOfAsync(seed, seed.FamilyId, "n2"));
        }

        [Fact]
        public async Task Payments_ShowsSinNombre_WhenNothingIdentifiesTheUser()
        {
            var seed = await SeedTeamAsync(fixture);

            Assert.Equal("Sin nombre", await PaymentsNameOfAsync(seed, seed.FamilyId, "n3"));
        }
    }
}
