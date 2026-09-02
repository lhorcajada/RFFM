#nullable enable
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries;
using RFFM.Api.Features.Federation.Teams.Services;
using Xunit;

namespace RFFM.Api.Tests.UnitTests
{
    /// <summary>
    /// GetTeamCallups used to fall back to the hardcoded literal 0 as the "temporada" passed to
    /// IActaService.GetMatchFromActaAsync when request.SeasonId failed to parse as an int. This
    /// regression test asserts the fallback now uses QueryApp.FallbackSeasonId (populated by the
    /// endpoint from the configured RffmOptions.CurrentSeasonId) instead of 0.
    /// </summary>
    public class GetTeamCallupsSeasonFallbackTests
    {
        [Fact]
        public async Task Handle_WhenSeasonIdDoesNotParse_UsesFallbackSeasonIdInsteadOfZero()
        {
            const string teamId = "T1";
            const int competitionId = 25255269;
            const int groupId = 25255283;
            const int fallbackSeasonId = 22;

            var calendarServiceMock = new Mock<ICalendarService>();
            calendarServiceMock
                .Setup(s => s.GetCalendarAsync(competitionId, groupId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new CalendarResponse
                {
                    MatchDays =
                    [
                        new CalendarMatchDayResponse
                        {
                            MatchDayNumber = 1,
                            Date = DateTime.UtcNow.Date.AddDays(-1),
                            Matches =
                            [
                                new MatchResponse
                                {
                                    MatchRecordCode = "ACTA1",
                                    LocalTeamCode = teamId,
                                    VisitorTeamCode = "T2",
                                    VisitorTeamName = "Rival",
                                    Date = DateTime.UtcNow.Date.AddDays(-1)
                                }
                            ]
                        }
                    ]
                });

            var matchDayServiceMock = new Mock<IMatchDayService>();
            matchDayServiceMock
                .Setup(s => s.GetActiveMatchDay(groupId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((MatchDayResponse)null!);

            var teamServiceMock = new Mock<ITeamService>();
            teamServiceMock
                .Setup(s => s.GetTeamDetailsAsync(teamId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TeamRffm());

            var actaServiceMock = new Mock<IActaService>();
            actaServiceMock
                .Setup(s => s.GetMatchFromActaAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm());

            using var cache = new MemoryCache(new MemoryCacheOptions());

            var handler = new GetTeamCallups.RequestHandler(
                calendarServiceMock.Object,
                actaServiceMock.Object,
                teamServiceMock.Object,
                matchDayServiceMock.Object,
                cache);

            var query = new GetTeamCallups.QueryApp(teamId, "not-a-number", competitionId, groupId, fallbackSeasonId);

            await handler.Handle(query, CancellationToken.None);

            actaServiceMock.Verify(
                s => s.GetMatchFromActaAsync("ACTA1", fallbackSeasonId, competitionId, groupId, It.IsAny<CancellationToken>()),
                Times.Once);
        }
    }
}
