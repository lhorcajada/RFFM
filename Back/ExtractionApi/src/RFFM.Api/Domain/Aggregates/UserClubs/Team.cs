using RFFM.Api;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.Aggregates.UserClubs
{
    public class Team : BaseEntity
    {
        public string Name { get; private set; }
        public int CategoryId { get; private set; }
        public int? LeagueId { get; private set; }
        public int? LeagueGroup { get; private set; }
        public int? RffmCompetitionId { get; private set; }
        public int? RffmGroupId { get; private set; }
        public string? UrlPhoto { get; set; }
        public string? RulesDocumentUrl { get; set; }
        public string ClubId { get; set; }
        public string SeasonId { get; set; }
        public string JoinCode { get; private set; }

        public Club Club { get; set; } = null!;
        public Category Category { get; private set; } = null!;
        public League? League { get; private set; } = null;
        public Season Season { get; set; } = null!;
        public List<SportEvent> SportEvents { get; set; } = null!;
        public List<TrainingSession> Trainings { get; set; } = null!;
        public List<TeamPlayer> Players { get; set; } = null!;
        public Team() { }
        public Team(TeamModelBase model)
        {
            Name = model.Name;
            CategoryId = model.CategoryId;
            UrlPhoto = model.UrlPhoto;
            ClubId = model.ClubId;
            SeasonId = model.SeasonId;
            LeagueId = model.LeagueId;
            LeagueGroup = model.LeagueGroup;
            RffmCompetitionId = model.RffmCompetitionId;
            RffmGroupId = model.RffmGroupId;
            JoinCode = Guid.NewGuid().ToString("N")[..ValidationConstants.TeamJoinCodeLength].ToUpper();
        }
        public void UpdateName(string name)
        {
            Name = name;
        }
        public void UpdateCategoryId(int categoryId)
        {
            CategoryId = categoryId;
        }
        public void UpdateClubId(string clubId)
        {
            ClubId = clubId;
        }
        public void UpdateUrlPhoto(string? urlPhoto)
        {
            UrlPhoto = urlPhoto;
        }
        public void UpdateRulesDocumentUrl(string? url)
        {
            RulesDocumentUrl = url;
        }
        public void UpdateSeasonId(string seasonId)
        {
            SeasonId = seasonId;
        }
        public void UpdateLeagueId(int? leagueId)
        {
            LeagueId = leagueId;
        }
        
        public void UpdateLeagueGroup(int? leagueGroup)
        {
            LeagueGroup = leagueGroup;
        }

        public void UpdateRffmCompetitionId(int? rffmCompetitionId)
        {
            RffmCompetitionId = rffmCompetitionId;
        }

        public void UpdateRffmGroupId(int? rffmGroupId)
        {
            RffmGroupId = rffmGroupId;
        }
    }
}
