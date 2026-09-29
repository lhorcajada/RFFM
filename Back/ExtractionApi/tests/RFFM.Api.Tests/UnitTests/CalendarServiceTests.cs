using Microsoft.Extensions.Options;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.MatchResults.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    public class CalendarServiceTests
    {
        [Fact]
        public async Task El_calendario_completo_sale_de_los_resultados_guardados_del_grupo()
        {
            var expected = new CalendarResponse { MatchDays = [new CalendarMatchDayResponse { MatchDayNumber = 1 }] };
            var resultsSyncService = new Mock<IRffmResultsSyncService>();
            resultsSyncService.Setup(s => s.GetCalendarAsync(26738048, 22, It.IsAny<CancellationToken>())).ReturnsAsync(expected);
            var sut = new CalendarService(resultsSyncService.Object, Options.Create(new RffmOptions { CurrentSeasonId = 22 }));

            var calendar = await sut.GetCalendarAsync(26738047, 26738048);

            Assert.Same(expected, calendar);
        }
    }
}
