using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.SeasonAccess
{
    public class SeasonAccessTrialPlayer : BaseEntity
    {
        public string TrialId { get; private set; } = null!;
        public string FederationPlayerCode { get; private set; } = null!;
        public string PlayerName { get; private set; } = null!;
        public string TeamCode { get; private set; } = null!;
        public string TeamName { get; private set; } = null!;
        public string Category { get; private set; } = null!;
        public int? BirthYear { get; private set; }
        public int? IdealDemarcationId { get; private set; }
        public int? TotalGoals { get; private set; }
        public int[] PossibleDemarcationIds { get; private set; } = Array.Empty<int>();

        public SeasonAccessTrial? Trial { get; private set; }

        protected SeasonAccessTrialPlayer() { }

        public static SeasonAccessTrialPlayer Create(
            string trialId,
            string federationPlayerCode,
            string playerName,
            string teamCode,
            string teamName,
            string category,
            int? birthYear,
            IEnumerable<int>? possibleDemarcationIds,
            int? idealDemarcationId,
            int? totalGoals)
        {
            var player = new SeasonAccessTrialPlayer();
            player.Update(
                trialId,
                federationPlayerCode,
                playerName,
                teamCode,
                teamName,
                category,
                birthYear,
                possibleDemarcationIds,
                idealDemarcationId,
                totalGoals);
            return player;
        }

        public void Update(
            string trialId,
            string federationPlayerCode,
            string playerName,
            string teamCode,
            string teamName,
            string category,
            int? birthYear,
            IEnumerable<int>? possibleDemarcationIds,
            int? idealDemarcationId,
            int? totalGoals)
        {
            TrialId = trialId;
            FederationPlayerCode = federationPlayerCode;
            PlayerName = playerName;
            TeamCode = teamCode;
            TeamName = teamName;
            Category = category;
            BirthYear = birthYear;
            IdealDemarcationId = idealDemarcationId;
            TotalGoals = totalGoals;
            PossibleDemarcationIds = NormalizeDemarcations(possibleDemarcationIds, idealDemarcationId);
        }

        public void SetBirthYear(int? birthYear)
        {
            BirthYear = birthYear;
        }

        public void SetIdealDemarcationId(int? idealDemarcationId)
        {
            IdealDemarcationId = idealDemarcationId;
            if (idealDemarcationId.HasValue && !PossibleDemarcationIds.Contains(idealDemarcationId.Value))
            {
                PossibleDemarcationIds = PossibleDemarcationIds.Append(idealDemarcationId.Value).Distinct().ToArray();
            }
        }

        public void SetPossibleDemarcationIds(IEnumerable<int>? possibleDemarcationIds)
        {
            PossibleDemarcationIds = NormalizeDemarcations(possibleDemarcationIds, IdealDemarcationId);
        }

        private static int[] NormalizeDemarcations(IEnumerable<int>? possibleDemarcationIds, int? idealDemarcationId)
        {
            var normalized = (possibleDemarcationIds ?? Array.Empty<int>())
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            if (idealDemarcationId.HasValue && !normalized.Contains(idealDemarcationId.Value))
            {
                normalized.Add(idealDemarcationId.Value);
            }

            return normalized.ToArray();
        }
    }
}