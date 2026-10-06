#nullable enable
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Moq;
using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Features.Coaches.Users.Commands;
using RFFM.Api.Features.Coaches.Users.Queries;
using RFFM.Api.Tests.Fixtures;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    [Collection(PostgresCollection.Name)]
    public class MyAccountHandlerTests
    {
        private readonly PostgresContainerFixture _fixture;

        public MyAccountHandlerTests(PostgresContainerFixture fixture)
        {
            _fixture = fixture;
        }

        private static (Mock<UserManager<IdentityUser>> Manager, IdentityUser User) MockUser()
        {
            var user = new IdentityUser { Id = Guid.NewGuid().ToString(), UserName = "anag", Email = "ana@example.com" };
            var store = new Mock<IUserStore<IdentityUser>>();
            var manager = new Mock<UserManager<IdentityUser>>(
                store.Object, null!, null!, null!, null!, null!, null!, null!, null!);
            manager.Setup(m => m.FindByIdAsync(user.Id)).ReturnsAsync(user);
            return (manager, user);
        }

        private static UpdateMyPersonalData.Command UpdateCommand(string userId, string phone = "") =>
            new() { UserId = userId, FirstName = "Ana", LastName = "García", SecondLastName = "López", PhoneNumber = phone };

        [Fact]
        public async Task GetMyAccount_WithoutPersonalData_ReturnsAliasEmailAndNullPersonalFields()
        {
            await using var db = _fixture.CreateDbContext();
            var (manager, user) = MockUser();

            var result = await new GetMyAccount.Handler(db, manager.Object)
                .Handle(new GetMyAccount.Query(user.Id), CancellationToken.None);

            Assert.Equal("anag", result.Alias);
            Assert.Equal("ana@example.com", result.Email);
            Assert.Null(result.FirstName);
            Assert.Null(result.LastName);
            Assert.Null(result.AvatarUrl);
        }

        [Fact]
        public async Task GetMyAccount_WithPersonalData_ReturnsIt()
        {
            await using var db = _fixture.CreateDbContext();
            var (manager, user) = MockUser();
            var data = UserPersonalData.Create(user.Id, "Ana", "García", null, "600000000");
            data.SetAvatar("https://storage/avatars/a.png");
            db.UserPersonalData.Add(data);
            await db.SaveChangesAsync();

            var result = await new GetMyAccount.Handler(db, manager.Object)
                .Handle(new GetMyAccount.Query(user.Id), CancellationToken.None);

            Assert.Equal("Ana", result.FirstName);
            Assert.Equal("García", result.LastName);
            Assert.Equal("600000000", result.PhoneNumber);
            Assert.Equal("https://storage/avatars/a.png", result.AvatarUrl);
        }

        [Fact]
        public async Task GetMyAccount_UnknownUser_ThrowsNotFound()
        {
            await using var db = _fixture.CreateDbContext();
            var (manager, _) = MockUser();

            await Assert.ThrowsAsync<NotFoundException>(() => new GetMyAccount.Handler(db, manager.Object)
                .Handle(new GetMyAccount.Query("missing"), CancellationToken.None).AsTask());
        }

        [Fact]
        public async Task UpdateMyPersonalData_FirstSave_CreatesRecord()
        {
            await using var db = _fixture.CreateDbContext();
            var (manager, user) = MockUser();

            var result = await new UpdateMyPersonalData.Handler(db, manager.Object)
                .Handle(UpdateCommand(user.Id), CancellationToken.None);

            Assert.Equal("Ana", result.FirstName);
            Assert.Equal("López", result.SecondLastName);
            await using var verifyDb = _fixture.CreateDbContext();
            Assert.Equal(1, await verifyDb.UserPersonalData.CountAsync(p => p.ApplicationUserId == user.Id));
        }

        [Fact]
        public async Task UpdateMyPersonalData_SecondSave_UpdatesWithoutDuplicating()
        {
            var (manager, user) = MockUser();
            await using (var db = _fixture.CreateDbContext())
            {
                await new UpdateMyPersonalData.Handler(db, manager.Object)
                    .Handle(UpdateCommand(user.Id), CancellationToken.None);
            }

            await using (var db = _fixture.CreateDbContext())
            {
                await new UpdateMyPersonalData.Handler(db, manager.Object)
                    .Handle(UpdateCommand(user.Id, phone: "+34 611 111 111"), CancellationToken.None);
            }

            await using var verifyDb = _fixture.CreateDbContext();
            var stored = await verifyDb.UserPersonalData.Where(p => p.ApplicationUserId == user.Id).ToListAsync();
            Assert.Single(stored);
            Assert.Equal("+34 611 111 111", stored[0].PhoneNumber);
        }
    }
}
