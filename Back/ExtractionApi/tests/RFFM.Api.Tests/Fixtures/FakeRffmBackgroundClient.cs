#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using RFFM.Api.Features.Federation.Clubs.Models;
using RFFM.Api.Features.Federation.Competitions.Models;
using RFFM.Api.Features.Federation.Players.Models;
using RFFM.Api.Features.Federation.SquadHistory.Services;
using RFFM.Api.Features.Federation.Teams.Models;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>Cliente RFFM en memoria para tests del historial de plantilla (sin red).</summary>
    public sealed class FakeRffmBackgroundClient : IRffmBackgroundClient
    {
        public TeamRffm? DefaultRoster { get; set; }
        public Dictionary<string, TeamRffm?> Rosters { get; } = new();
        public Func<IReadOnlyList<ClubTeamDirectoryItem>> ClubTeams { get; set; } = () => new List<ClubTeamDirectoryItem>();
        public List<RffmCompetition> Competitions { get; } = new();
        public Dictionary<string, List<RffmGroup>> Groups { get; } = new();
        public Dictionary<string, List<RffmGroupTeam>> GroupTeams { get; } = new();
        public Dictionary<(string Player, int Season), Func<Player?>> Sheets { get; } = new();
        public Dictionary<string, List<RffmGroupMatch>> GroupMatches { get; } = new();
        public Dictionary<string, MatchRffm> Actas { get; } = new();
        public HashSet<string> FailingActas { get; } = new();
        public Dictionary<(string Group, string Team), List<RffmGroupMatch>> TeamMatches { get; } = new();

        public List<string> RequestedRosters { get; } = new();
        public List<string> RequestedGroupTeams { get; } = new();
        public List<(string Player, int Season)> RequestedSheets { get; } = new();
        public Dictionary<string, int> ActaCalls { get; } = new();
        public Dictionary<string, int> GroupCalls { get; } = new();
        public int ClubTeamsCalls { get; private set; }

        public Task<TeamRffm?> GetTeamRosterAsync(string teamCode, CancellationToken cancellationToken)
        {
            RequestedRosters.Add(teamCode);
            return Task.FromResult(Rosters.TryGetValue(teamCode, out var roster) ? roster : DefaultRoster);
        }

        public Task<IReadOnlyList<ClubTeamDirectoryItem>> GetClubTeamsAsync(string clubCode, int seasonId, CancellationToken cancellationToken)
        {
            ClubTeamsCalls++;
            return Task.FromResult(ClubTeams());
        }

        public Task<IReadOnlyList<RffmCompetition>> GetCompetitionsAsync(int seasonId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RffmCompetition>>(Competitions);

        public Task<IReadOnlyList<RffmGroup>> GetGroupsAsync(string competitionCode, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RffmGroup>>(Groups.GetValueOrDefault(competitionCode) ?? new List<RffmGroup>());

        public Task<IReadOnlyList<RffmGroupTeam>> GetGroupTeamsAsync(string groupCode, CancellationToken cancellationToken)
        {
            RequestedGroupTeams.Add(groupCode);
            return Task.FromResult<IReadOnlyList<RffmGroupTeam>>(GroupTeams.GetValueOrDefault(groupCode) ?? new List<RffmGroupTeam>());
        }

        public Task<IReadOnlyList<RffmGroupMatch>> GetTeamLastPlayedMatchesAsync(string groupCode, string teamCode, int count,
            CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RffmGroupMatch>>(
                (TeamMatches.GetValueOrDefault((groupCode, teamCode)) ?? new List<RffmGroupMatch>()).Take(count).ToList());

        public Task<Player?> GetPlayerSheetAsync(string playerCode, int seasonId, CancellationToken cancellationToken)
        {
            RequestedSheets.Add((playerCode, seasonId));
            return Task.FromResult(Sheets.TryGetValue((playerCode, seasonId), out var sheet) ? sheet() : new Player { PlayerId = playerCode });
        }

        public Task<IReadOnlyList<RffmGroupMatch>> GetGroupPlayedMatchesAsync(string groupCode, CancellationToken cancellationToken)
        {
            GroupCalls[groupCode] = GroupCalls.GetValueOrDefault(groupCode) + 1;
            return Task.FromResult<IReadOnlyList<RffmGroupMatch>>(GroupMatches.GetValueOrDefault(groupCode) ?? new List<RffmGroupMatch>());
        }

        public Task<MatchRffm?> GetActaAsync(string recordCode, int seasonId, string competitionCode, string groupCode, CancellationToken cancellationToken)
        {
            ActaCalls[recordCode] = ActaCalls.GetValueOrDefault(recordCode) + 1;
            if (FailingActas.Contains(recordCode)) throw new HttpRequestException("500");
            return Task.FromResult(Actas.GetValueOrDefault(recordCode));
        }

        public Dictionary<string, List<TeamResponse>> Standings { get; } = new();
        public List<(string Group, int Round)> RequestedStandings { get; } = new();

        public Task<IReadOnlyList<TeamResponse>?> GetStandingsAsync(string groupCode, int round, CancellationToken cancellationToken)
        {
            RequestedStandings.Add((groupCode, round));
            return Task.FromResult<IReadOnlyList<TeamResponse>?>(Standings.GetValueOrDefault(groupCode));
        }
    }
}
