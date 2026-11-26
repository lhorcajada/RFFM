#nullable enable
using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Models;
using RFFM.Api.Features.Coaches.Trainings.Sessions;
using RFFM.Api.Infrastructure.Persistence;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// Leak tests for TaskTrainingBase (exercises of the club's shared library), openspec change
    /// personal-and-club-spaces, Step 6. Runs the production user-aware <see cref="AppDbContext"/> on real
    /// PostgreSQL. Cross-club assertions must fail until the filter is registered on TaskTrainingBase.
    /// </summary>
    [Collection(PostgresCollection.Name)]
    public class ClubDataIsolationTaskTrainingTests
    {
        private const int SeededCountryId = 1;
        private readonly PostgresContainerFixture _fixture;

        public ClubDataIsolationTaskTrainingTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private sealed record ClubSeed(Club Club, Team Team, TaskTrainingBase Exercise);

        private async Task<ClubSeed> SeedClubAsync(AppDbContext db)
        {
            var club = Club.Create($"S6 Club {Guid.NewGuid():N}", SeededCountryId);
            db.Clubs.Add(club);
            await db.SaveChangesAsync();

            var season = Season.Create(
                $"Season {Guid.NewGuid():N}",
                DateTime.UtcNow.AddDays(-1),
                DateTime.UtcNow.AddMonths(9),
                isActive: true,
                club: club);
            db.Seasons.Add(season);
            await db.SaveChangesAsync();

            var team = new Team(new TeamModelBase
            {
                Name = $"S6 Team {Guid.NewGuid():N}",
                CategoryId = Category.NationalCategory.Id,
                ClubId = club.Id,
                SeasonId = season.Id
            });
            db.Teams.Add(team);
            await db.SaveChangesAsync();

            var exercise = new TaskTrainingBase
            {
                Name = $"S6 Exercise {Guid.NewGuid():N}",
                Tipo = "Analitico",
                Objetivo = "Objetivo",
                Logistica = "Logistica",
                Descripcion = "Descripcion",
                ClubId = club.Id
            };
            db.TaskTrainingBases.Add(exercise);
            await db.SaveChangesAsync();

            return new ClubSeed(club, team, exercise);
        }

        private async Task<(ClubSeed A, ClubSeed B)> SeedTwoClubsAsync()
        {
            await using var seedDb = _fixture.CreateDbContext();
            var a = await SeedClubAsync(seedDb);
            var b = await SeedClubAsync(seedDb);
            return (a, b);
        }

        private async Task<string> CreateClubMemberAsync(params Club[] clubs)
        {
            var userId = $"s6-member-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            foreach (var club in clubs)
            {
                seedDb.UserClubs.Add(new UserClub(userId, club.Id, Membership.Coach.Id));
            }

            await seedDb.SaveChangesAsync();
            return userId;
        }

        private async Task<string> SeedMixedSessionAsync(ClubSeed a, ClubSeed b)
        {
            await using var db = _fixture.CreateDbContext();
            var session = new TrainingSession
            {
                Name = $"S6 Session {Guid.NewGuid():N}",
                Description = "S6 description",
                Location = "S6 location",
                TeamId = a.Team.Id
            };
            db.TrainingSessions.Add(session);
            await db.SaveChangesAsync();

            var block = new SessionBlock(session.Id, 1, "S6 block", null);
            db.SessionBlocks.Add(block);
            await db.SaveChangesAsync();

            db.SessionBlockExercises.Add(new SessionBlockExercise(block.Id, a.Exercise.Id, 1));
            db.SessionBlockExercises.Add(new SessionBlockExercise(block.Id, b.Exercise.Id, 2));
            await db.SaveChangesAsync();

            return session.Id;
        }

        [Fact]
        public async Task Session_with_exercise_of_other_club_read_by_member_of_its_club_shows_no_other_club_exercise()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var sessionId = await SeedMixedSessionAsync(a, b);
            var userA = await CreateClubMemberAsync(a.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var handler = new GetSessionHandler(db);
            var result = await handler.Handle(new GetSessionQuery(sessionId, userA), CancellationToken.None);

            Assert.NotNull(result);
            var exercises = result!.Blocks.SelectMany(block => block.Exercises).ToList();
            Assert.Contains(exercises, e => e.Name == a.Exercise.Name);
            Assert.DoesNotContain(exercises, e => e.Name == b.Exercise.Name);
        }

        [Fact]
        public async Task Session_with_exercise_of_other_club_read_by_member_of_both_clubs_shows_that_exercise()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var sessionId = await SeedMixedSessionAsync(a, b);
            var userAb = await CreateClubMemberAsync(a.Club, b.Club);

            await using var db = _fixture.CreateDbContext(userAb);
            var handler = new GetSessionHandler(db);
            var result = await handler.Handle(new GetSessionQuery(sessionId, userAb), CancellationToken.None);

            Assert.NotNull(result);
            var exercises = result!.Blocks.SelectMany(block => block.Exercises).ToList();
            Assert.Contains(exercises, e => e.Name == b.Exercise.Name && e.Objetivo == b.Exercise.Objetivo);
        }

        [Fact]
        public async Task Session_read_by_non_member_of_its_club_is_denied_without_null_reference()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var sessionId = await SeedMixedSessionAsync(a, b);
            var outsider = await CreateClubMemberAsync(b.Club);

            await using var db = _fixture.CreateDbContext(outsider);
            var handler = new GetSessionHandler(db);

            var ex = await Assert.ThrowsAnyAsync<Exception>(() =>
                handler.Handle(new GetSessionQuery(sessionId, outsider), CancellationToken.None).AsTask());

            Assert.IsNotType<NullReferenceException>(ex);
            Assert.IsType<DomainException>(ex);
        }

        private async Task<string> CreateTeamLinkUserAsync(Team team)
        {
            var userId = $"s6-teamlink-{Guid.NewGuid():N}";
            await using var seedDb = _fixture.CreateDbContext();
            seedDb.UserTeams.Add(new UserTeam(userId, team.Id, Membership.Player.Id));
            await seedDb.SaveChangesAsync();
            return userId;
        }

        [Fact]
        public async Task Exercise_read_by_user_of_other_club_returns_null()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(b.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var own = await db.TaskTrainingBases.AsNoTracking().FirstOrDefaultAsync(t => t.Id == b.Exercise.Id);
            var other = await db.TaskTrainingBases.AsNoTracking().FirstOrDefaultAsync(t => t.Id == a.Exercise.Id);

            Assert.NotNull(own);
            Assert.Null(other);
        }

        [Fact]
        public async Task Exercise_loaded_for_modification_by_user_of_other_club_returns_null()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(b.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var other = await db.TaskTrainingBases.FirstOrDefaultAsync(t => t.Id == a.Exercise.Id);

            Assert.Null(other);
        }

        [Fact]
        public async Task Exercise_find_by_id_by_user_of_other_club_returns_null()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(b.Club);

            await using var db = _fixture.CreateDbContext(userB);
            var found = await db.TaskTrainingBases.FindAsync(a.Exercise.Id);

            Assert.Null(found);
        }

        [Fact]
        public async Task Exercise_bulk_update_by_user_of_other_club_affects_no_rows_and_leaves_row_unchanged()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var userB = await CreateClubMemberAsync(b.Club);
            var originalName = a.Exercise.Name;

            await using (var db = _fixture.CreateDbContext(userB))
            {
                var affected = await db.TaskTrainingBases
                    .Where(t => t.Id == a.Exercise.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Name, "Leaked by club B"));
                Assert.Equal(0, affected);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.TaskTrainingBases.AsNoTracking().SingleAsync(t => t.Id == a.Exercise.Id);
            Assert.Equal(originalName, stored.Name);
        }

        [Fact]
        public async Task Exercise_read_by_member_of_its_club_returns_it()
        {
            var (a, _) = await SeedTwoClubsAsync();
            var userA = await CreateClubMemberAsync(a.Club);

            await using var db = _fixture.CreateDbContext(userA);
            var exercise = await db.TaskTrainingBases.AsNoTracking().FirstOrDefaultAsync(t => t.Id == a.Exercise.Id);

            Assert.NotNull(exercise);
        }

        [Fact]
        public async Task Exercise_read_by_team_link_user_of_its_club_returns_it()
        {
            var (a, _) = await SeedTwoClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(a.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var exercise = await db.TaskTrainingBases.AsNoTracking().FirstOrDefaultAsync(t => t.Id == a.Exercise.Id);

            Assert.NotNull(exercise);
        }

        [Fact]
        public async Task Exercise_read_by_team_link_user_of_other_club_returns_null()
        {
            var (a, b) = await SeedTwoClubsAsync();
            var linkUser = await CreateTeamLinkUserAsync(a.Team);

            await using var db = _fixture.CreateDbContext(linkUser);
            var other = await db.TaskTrainingBases.AsNoTracking().FirstOrDefaultAsync(t => t.Id == b.Exercise.Id);

            Assert.Null(other);
        }
    }
}
