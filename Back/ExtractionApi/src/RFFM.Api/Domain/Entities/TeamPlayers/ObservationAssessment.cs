using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.TeamPlayers
{
    /// <summary>Valoración de una observación: «Lo hace» / «A veces» / «No lo hace».</summary>
    public sealed class ObservationAssessment : SmartEnum<ObservationAssessment>
    {
        public static readonly ObservationAssessment Achieved = new(nameof(Achieved), 1);
        public static readonly ObservationAssessment Partial = new(nameof(Partial), 2);
        public static readonly ObservationAssessment NotAchieved = new(nameof(NotAchieved), 3);

        private ObservationAssessment(string name, int value) : base(name, value)
        {
        }
    }
}
