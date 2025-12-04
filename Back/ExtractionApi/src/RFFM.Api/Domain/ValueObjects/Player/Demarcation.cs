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
            if (possibleDemarcationIds == null || possibleDemarcationIds.Count == 0)
                throw new ArgumentException(ValidationConstants.LeastOneDemarcation);

            if (!possibleDemarcationIds.Contains(activePositionId))
                throw new ArgumentException(ValidationConstants.MustBeActiveOneDemarcation);

            PossibleDemarcationIds = possibleDemarcationIds;
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

