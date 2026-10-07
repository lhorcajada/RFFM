#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Hellang.Middleware.ProblemDetails;
using Mediator;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Moq;
using RFFM.Api.DependencyInjection;
using RFFM.Api.Features.Federation.Competitions.Queries.GetCalendar.Responses;
using RFFM.Api.Features.Federation.Competitions.Services;
using RFFM.Api.Features.Federation.Teams.Models;
using RFFM.Api.Features.Federation.Teams.Queries;
using RFFM.Api.Features.Federation.Teams.Queries.Responses;
using RFFM.Api.Features.Federation.Teams.Services;
using RFFM.Api.Infrastructure.Options;
using Xunit;

namespace RFFM.Api.Tests.IntegrationTests
{
    /// <summary>
    /// GET /teams/{teamCode}/goal-sectors used to evaluate both teams with a single competition/group,
    /// a single match duration and actas of the hardcoded season 21. Each team now has its own
    /// competition/group (team 2 falls back to team 1's) and match duration, and actas use
    /// RffmOptions.CurrentSeasonId.
    /// </summary>
    public class GetGoalSectorsCrossGroupTests
    {
        private const int CurrentSeasonId = 22;
        private const int PreviousSeasonId = 21;

        private sealed class StubCalendarService : ICalendarService
        {
            public Dictionary<(int Competition, int Group), CalendarResponse> Calendars { get; } = new();
            public List<(int Competition, int Group)> Requests { get; } = new();

            public Task<CalendarResponse> GetCalendarAsync(int competicion, int groupId, CancellationToken cancellationToken = default)
            {
                Requests.Add((competicion, groupId));
                return Task.FromResult(Calendars.TryGetValue((competicion, groupId), out var calendar)
                    ? calendar
                    : new CalendarResponse());
            }
        }

        private sealed record TestContext(IHost Host, HttpClient Client, StubCalendarService Calendar, Mock<IActaService> Acta) : IDisposable
        {
            public void Dispose() => Host.Dispose();
        }

        private static CalendarResponse CalendarWith(params (string Acta, string Local, string Visitor)[] matches) => new()
        {
            MatchDays =
            [
                new CalendarMatchDayResponse
                {
                    Date = DateTime.Now.Date.AddDays(-7),
                    Matches = matches.Select(m => new MatchResponse
                    {
                        MatchRecordCode = m.Acta,
                        LocalTeamCode = m.Local,
                        VisitorTeamCode = m.Visitor,
                    }).ToList(),
                },
            ],
        };

        private static async Task<TestContext> StartHostAsync()
        {
            var calendar = new StubCalendarService();
            calendar.Calendars[(100, 200)] = CalendarWith(("A1", "11", "12"));
            calendar.Calendars[(300, 400)] = CalendarWith(("B1", "21", "22"));

            calendar.Calendars[(500, 600)] = CalendarWith(("C1", "31", "32"));

            var competitions = new Mock<ICompetitionService>();
            competitions
                .Setup(s => s.GetCompetitionsAsync(It.IsAny<int?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([
                    new ResponseCompetition(100, "Comp 80", 80, "F7"),
                    new ResponseCompetition(300, "Comp 90", 90, "F11"),
                ]);
            competitions
                .Setup(s => s.GetCompetitionsAsync(PreviousSeasonId, It.IsAny<CancellationToken>()))
                .ReturnsAsync([new ResponseCompetition(500, "Infantil temporada anterior", 70, "INFANTILES")]);

            var acta = new Mock<IActaService>();
            acta.Setup(s => s.GetMatchFromActaAsync("A1", It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm
                {
                    LocalTeamCode = "11", LocalTeam = "Team 11", AwayTeamCode = "12", AwayTeam = "Team 12",
                    LocalGoalsList = [new Goal { Minute = "5", GoalType = "100" }],
                });
            acta.Setup(s => s.GetMatchFromActaAsync("B1", It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm
                {
                    LocalTeamCode = "21", LocalTeam = "Team 21", AwayTeamCode = "22", AwayTeam = "Team 22",
                    AwayGoalsList = [new Goal { Minute = "80", GoalType = "100" }],
                });

            acta.Setup(s => s.GetMatchFromActaAsync("C1", It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new MatchRffm { LocalTeamCode = "31", AwayTeamCode = "32" });

            var host = new HostBuilder()
                .ConfigureWebHost(webBuilder =>
                {
                    webBuilder
                        .UseTestServer()
                        .ConfigureServices(services =>
                        {
                            services.AddRouting();
                            services.AddMvcCore();
                            services.AddCustomProblemDetails();
                            services.AddSingleton<ICalendarService>(calendar);
                            services.AddSingleton(competitions.Object);
                            services.AddSingleton(acta.Object);
                            services.AddSingleton<ISectorFactory, SectorFactory>();
                            services.Configure<RffmOptions>(o => o.CurrentSeasonId = CurrentSeasonId);
                            services.AddMediator(o => { o.ServiceLifetime = ServiceLifetime.Scoped; });
                        })
                        .Configure(app =>
                        {
                            app.UseProblemDetails();
                            app.UseRouting();
                            app.UseEndpoints(endpoints => new GetGoalSectors().AddRoutes(endpoints));
                        });
                })
                .Build();

            await host.StartAsync();
            return new TestContext(host, host.GetTestClient(), calendar, acta);
        }

        private static async Task<List<GoalSectorsResponse>> GetSectorsAsync(HttpClient client, string query)
        {
            var response = await client.GetAsync($"/teams/11/goal-sectors?{query}");
            response.EnsureSuccessStatusCode();
            return (await response.Content.ReadFromJsonAsync<List<GoalSectorsResponse>>())!;
        }

        [Fact]
        public async Task GetGoalSectors_WithoutTeamCode2_ReturnsBadRequest()
        {
            using var ctx = await StartHostAsync();

            var response = await ctx.Client.GetAsync("/teams/11/goal-sectors?competitionId=100&groupId=200&teamCode1=11");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetGoalSectors_WithoutCompetitionAndGroup_ReturnsBadRequest()
        {
            using var ctx = await StartHostAsync();

            var response = await ctx.Client.GetAsync("/teams/11/goal-sectors?teamCode1=11&teamCode2=21");

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task GetGoalSectors_WithCompetitionAndGroupPerTeam_UsesEachTeamCalendar()
        {
            using var ctx = await StartHostAsync();

            await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=21&competitionId2=300&groupId2=400");

            Assert.Equal(new[] { (100, 200), (300, 400) }, ctx.Calendar.Requests.Distinct().OrderBy(r => r.Competition));
        }

        [Fact]
        public async Task GetGoalSectors_WithCompetitionAndGroupPerTeam_RequestsActasWithEachTeamCompetitionAndGroup()
        {
            using var ctx = await StartHostAsync();

            await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=21&competitionId2=300&groupId2=400");

            ctx.Acta.Verify(s => s.GetMatchFromActaAsync("A1", It.IsAny<int>(), 100, 200, It.IsAny<CancellationToken>()), Times.Once);
            ctx.Acta.Verify(s => s.GetMatchFromActaAsync("B1", It.IsAny<int>(), 300, 400, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task GetGoalSectors_WithoutCompetitionAndGroupForTeam2_FallsBackToTeam1Ones()
        {
            using var ctx = await StartHostAsync();

            await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=12");

            Assert.All(ctx.Calendar.Requests, r => Assert.Equal((100, 200), r));
        }

        [Fact]
        public async Task GetGoalSectors_RequestsActasWithConfiguredCurrentSeason()
        {
            using var ctx = await StartHostAsync();

            await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=21&competitionId2=300&groupId2=400");

            ctx.Acta.Verify(s => s.GetMatchFromActaAsync(It.IsAny<string>(), It.Is<int>(season => season != CurrentSeasonId), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task GetGoalSectors_WithDifferentMatchDurations_BuildsSectorsFromEachTeamDuration()
        {
            using var ctx = await StartHostAsync();

            var result = await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=21&competitionId2=300&groupId2=400");

            Assert.Equal((80, 6, 80), (result[0].MatchTime, result[0].Sectors.Count, result[0].Sectors[^1].EndMinute));
            Assert.Equal((90, 6, 90), (result[1].MatchTime, result[1].Sectors.Count, result[1].Sectors[^1].EndMinute));
        }

        [Fact]
        public async Task GetGoalSectors_WithSeason_UsesMatchTimeOfThatSeasonCompetition()
        {
            using var ctx = await StartHostAsync();

            var result = await GetSectorsAsync(ctx.Client, "season=21&competitionId=500&groupId=600&teamCode1=31&teamCode2=32");

            Assert.Equal((70, 70), (result[0].MatchTime, result[0].Sectors[^1].EndMinute));
        }

        [Fact]
        public async Task GetGoalSectors_WithSeason_RequestsActasOfThatSeason()
        {
            using var ctx = await StartHostAsync();

            await GetSectorsAsync(ctx.Client, "season=21&competitionId=500&groupId=600&teamCode1=31&teamCode2=32");

            ctx.Acta.Verify(s => s.GetMatchFromActaAsync("C1", PreviousSeasonId, 500, 600, It.IsAny<CancellationToken>()), Times.AtLeastOnce);
        }

        [Fact]
        public async Task GetGoalSectors_WithoutSeason_FindsCompetitionInOtherSelectableSeasons()
        {
            using var ctx = await StartHostAsync();

            var result = await GetSectorsAsync(ctx.Client, "competitionId=500&groupId=600&teamCode1=31&teamCode2=32");

            Assert.Equal(70, result[0].MatchTime);
        }

        [Fact]
        public async Task GetGoalSectors_WithUnknownCompetition_ReturnsNotFoundInsteadOfDefaultDuration()
        {
            using var ctx = await StartHostAsync();

            var response = await ctx.Client.GetAsync("/teams/31/goal-sectors?competitionId=999&groupId=600&teamCode1=31&teamCode2=32");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task GetGoalSectors_CountsTeam2GoalsFromItsOwnGroupActas()
        {
            using var ctx = await StartHostAsync();

            var result = await GetSectorsAsync(ctx.Client, "competitionId=100&groupId=200&teamCode1=11&teamCode2=21&competitionId2=300&groupId2=400");

            Assert.Equal((0, 1, 1), (result[1].TotalGoalsFor, result[1].TotalGoalsAgainst, result[1].Sectors[^1].GoalsAgainst));
        }
    }
}
