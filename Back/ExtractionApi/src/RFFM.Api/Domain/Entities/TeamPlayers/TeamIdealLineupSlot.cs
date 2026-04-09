using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    public class TeamIdealLineupSlot : BaseEntity
    {
        public string LineupId { get; private set; } = null!;
        public int SlotIndex { get; private set; }
        public string? TeamPlayerId { get; private set; }

        public TeamIdealLineup? Lineup { get; private set; }

        protected TeamIdealLineupSlot() { }

        public static TeamIdealLineupSlot Create(string lineupId, int slotIndex, string? teamPlayerId)
        {
            return new TeamIdealLineupSlot { LineupId = lineupId, SlotIndex = slotIndex, TeamPlayerId = teamPlayerId };
        }
    }
}
