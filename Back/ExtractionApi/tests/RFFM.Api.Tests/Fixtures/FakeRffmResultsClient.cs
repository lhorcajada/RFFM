#nullable enable
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Domain.Entities.Federation.Results;
using RFFM.Api.Features.Federation.Competitions.Models.ApiRffm;
using RFFM.Api.Features.Federation.MatchResults.Services;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>Cliente RFFM interactivo en memoria para los tests de resultados (sin red).</summary>
    public sealed class FakeRffmResultsClient : IRffmResultsClient
    {
        private int _roundCalls;
        private int _competitionCalls;

        public ConcurrentDictionary<(string Group, int Round), CalendarRffm> Rounds { get; } = new();
        public RffmCompetitionInfo? Competition { get; set; } = new(22, 80, 2, RffmPointsSystem.Default);
        public HashSet<int> FailingRounds { get; } = new();
        public List<int> RequestedRounds { get; } = new();
        public bool Fail { get; set; }
        public TimeSpan Delay { get; set; } = TimeSpan.Zero;

        public int RoundCalls => _roundCalls;
        public int CompetitionCalls => _competitionCalls;

        public async Task<CalendarRffm?> GetRoundAsync(string groupCode, int round, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _roundCalls);
            if (Delay > TimeSpan.Zero) await Task.Delay(Delay, cancellationToken);
            lock (RequestedRounds) RequestedRounds.Add(round);
            if (Fail || FailingRounds.Contains(round)) throw new HttpRequestException("RFFM no disponible");
            return Rounds.GetValueOrDefault((groupCode, round));
        }

        public Task<RffmCompetitionInfo?> FindCompetitionAsync(string competitionCode, IReadOnlyList<int> seasonIds,
            CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _competitionCalls);
            return Task.FromResult(Competition);
        }

        public static CalendarRffm Calendar(string groupCode, int round, params MatchInfo[] matches) => new()
        {
            CompetitionCode = "26738047",
            CompetitionName = "SUPERLIGA CADETE",
            GroupCode = groupCode,
            GroupName = "Grupo Unico",
            Matchday = round.ToString(),
            MatchdayList =
            [
                new MatchdayListWrapper
                {
                    Matchdays =
                    [
                        new MatchdayEntry { MatchdayCode = "1", Name = "1", Date = "26/09/2026" },
                        new MatchdayEntry { MatchdayCode = "2", Name = "2", Date = "10/10/2026" }
                    ]
                }
            ],
            Matches = matches.ToList()
        };

        public static MatchInfo Match(string recordCode, string date, string time, string recordClosed = "0",
            string localGoals = "", string visitorGoals = "") => new()
        {
            MatchRecordCode = recordCode,
            HasRecords = recordClosed,
            RecordClosed = recordClosed,
            Date = date,
            Time = time,
            LocalTeamCode = "1598",
            LocalTeamName = "A.D. UNION ADARVE 'A'",
            LocalGoals = localGoals,
            VisitorTeamCode = "8972474",
            VisitorTeamName = "A.D. TORREJON C.F. 'A'",
            VisitorGoals = visitorGoals
        };
    }

    public sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;

        public override DateTimeOffset GetUtcNow() => Now;

        public void Advance(TimeSpan by) => Now = Now.Add(by);
    }
}
