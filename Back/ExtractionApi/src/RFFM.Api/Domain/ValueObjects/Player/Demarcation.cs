using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Models;

namespace RFFM.Api.Domain.ValueObjects.Player
{
    public class Demarcation : ValueObject
    {
        public List<int>? PossibleDemarcationIds { get; private set; }
        public int ActivePositionId { get; private set; }

        private Demarcation(List<int>? possibleDemarcationIds, int activePositionId)
        {
            // Allow empty or null possible demarcations (player may have no positions assigned).
            PossibleDemarcationIds = possibleDemarcationIds ?? new List<int>();

            // If there are possible demarcations, the active position must belong to them.
            if (PossibleDemarcationIds.Count > 0 && !PossibleDemarcationIds.Contains(activePositionId))
                throw new ArgumentException(ValidationConstants.MustBeActiveOneDemarcation);

            // ActivePositionId == 0 will represent 'no active position'.
            ActivePositionId = activePositionId;
        }

        public static Demarcation Create(DemarcationModel demarcationModel)
        {
            return new Demarcation(demarcationModel.PossibleDemarcations, demarcationModel.ActivePositionId);
        }

        protected override IEnumerable<object?> GetEqualityComponents()
        {
            yield return PossibleDemarcationIds;
            yield return ActivePositionId;
        }

        public IEnumerable<DemarcationMaster> GetPossibleDemarcations()
        {
            return PossibleDemarcationIds?.Select(DemarcationMaster.GetById) ?? Enumerable.Empty<DemarcationMaster>();
        }

        public DemarcationMaster GetActivePosition()
        {
            return DemarcationMaster.GetById(ActivePositionId);
        }
    }
}

