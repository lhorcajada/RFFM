using RFFM.Api.Domain;
using RFFM.Api.Domain.Entities.Formations;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamIdealLineup : BaseEntity
    {
        public string TeamId { get; private set; } = null!;
        public string SeasonId { get; private set; } = null!;
        public string FormationId { get; private set; } = null!;

        public Formation? Formation { get; private set; }
        public ICollection<TeamIdealLineupSlot> Slots { get; private set; } = new List<TeamIdealLineupSlot>();

        protected TeamIdealLineup() { }

        public static TeamIdealLineup Create(string teamId, string seasonId, string formationId)
        {
            return new TeamIdealLineup { TeamId = teamId, SeasonId = seasonId, FormationId = formationId };
        }

        public void UpdateFormation(string formationId)
        {
            FormationId = formationId;
        }
    }
}
