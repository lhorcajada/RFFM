using RFFM.Api.Domain;

namespace RFFM.Api.Domain.Entities.SeasonAccess
{
    public class SeasonAccessTrialDayRating : BaseEntity
    {
        public string TrialDayId { get; private set; } = null!;
        public string TrialPlayerId { get; private set; } = null!;
        public decimal? Score { get; private set; }
        public string? Notes { get; private set; }
        public string? Status { get; private set; }
        public int? IdealDemarcationId { get; private set; }
        public int[] PossibleDemarcationIds { get; private set; } = Array.Empty<int>();
        public int? TotalGoals { get; private set; }

        public SeasonAccessTrialDay? TrialDay { get; private set; }
        public SeasonAccessTrialPlayer? TrialPlayer { get; private set; }

        protected SeasonAccessTrialDayRating() { }

        public static SeasonAccessTrialDayRating Create(string trialDayId, string trialPlayerId, decimal? score = null, string? notes = null, string? status = null, int? idealDemarcationId = null, IEnumerable<int>? possibleDemarcationIds = null, int? totalGoals = null)
        {
            return new SeasonAccessTrialDayRating
            {
                TrialDayId = trialDayId,
                TrialPlayerId = trialPlayerId,
                Score = score,
                Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
                Status = string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
                IdealDemarcationId = idealDemarcationId,
                PossibleDemarcationIds = possibleDemarcationIds?.ToArray() ?? Array.Empty<int>(),
                TotalGoals = totalGoals
            };
        }

        public void Update(decimal? score, string? notes, string? status, int? idealDemarcationId, IEnumerable<int>? possibleDemarcationIds, int? totalGoals = null)
        {
            Score = score;
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
            Status = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
            IdealDemarcationId = idealDemarcationId;
            PossibleDemarcationIds = possibleDemarcationIds?.ToArray() ?? Array.Empty<int>();
            TotalGoals = totalGoals;
        }
    }
}
