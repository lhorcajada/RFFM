using System;
using RFFM.Api.Domain.Entities.Federation.MatchResultNotifications;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class MatchResultNotificationEntitiesTests
    {
        private static readonly DateTime Now = new(2026, 10, 4, 18, 0, 0, DateTimeKind.Utc);

        [Fact]
        public void OptOut_Create_guarda_el_usuario_y_la_fecha()
        {
            var optOut = MatchResultNotificationOptOut.Create("user-1", Now);

            Assert.Equal("user-1", optOut.UserId);
            Assert.Equal(Now, optOut.CreatedAt);
        }

        [Theory]
        [InlineData("")]
        [InlineData("   ")]
        public void OptOut_Create_falla_sin_usuario(string userId)
        {
            Assert.Throws<ArgumentException>(() => MatchResultNotificationOptOut.Create(userId, Now));
        }

        [Fact]
        public void Log_Create_guarda_el_partido_notificado_con_codigos_recortados()
        {
            var log = MatchResultNotificationLog.Create("user-1", " 123456 ", " 555 ", "2", "1", Now);

            Assert.Equal("user-1", log.UserId);
            Assert.Equal("123456", log.RecordCode);
            Assert.Equal("555", log.TeamCode);
            Assert.Equal("2", log.LocalGoals);
            Assert.Equal("1", log.VisitorGoals);
            Assert.Equal(Now, log.NotifiedAt);
        }

        [Theory]
        [InlineData("", "123456", "555")]
        [InlineData("user-1", "", "555")]
        [InlineData("user-1", "123456", " ")]
        public void Log_Create_falla_sin_usuario_partido_o_equipo(string userId, string recordCode, string teamCode)
        {
            Assert.Throws<ArgumentException>(() =>
                MatchResultNotificationLog.Create(userId, recordCode, teamCode, "2", "1", Now));
        }
    }
}
