namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TacticalGoalsEnum
    {
        public static TacticalGoalsEnum Mark = new TacticalGoalsEnum(1, "Marcaje");
        public static TacticalGoalsEnum Retread = new TacticalGoalsEnum(2, "Repliegue");
        public static TacticalGoalsEnum Coverage = new TacticalGoalsEnum(3, "Cobertura");
        public static TacticalGoalsEnum Swap = new TacticalGoalsEnum(4, "Permuta");
        public static TacticalGoalsEnum DefensiveSurveillance = new TacticalGoalsEnum(5, "Vigilancia defensiva");
        public static TacticalGoalsEnum Timing = new TacticalGoalsEnum(6, "Temporizaciones");
        public static TacticalGoalsEnum Tackle = new TacticalGoalsEnum(7, "Entrada");
        public static TacticalGoalsEnum Charge = new TacticalGoalsEnum(8, "Carga");
        public static TacticalGoalsEnum Anticipate = new TacticalGoalsEnum(9, "Anticipación");
        public static TacticalGoalsEnum Interception = new TacticalGoalsEnum(10, "Intercepción");
        public static TacticalGoalsEnum Pressing = new TacticalGoalsEnum(11, "Pressing");
        public static TacticalGoalsEnum PressingAfterLosingPossesion = new TacticalGoalsEnum(12, "Pressing tras pérdida");
        public static TacticalGoalsEnum UnMarks = new TacticalGoalsEnum(13, "Desmarques");
        public static TacticalGoalsEnum OffensiveSupports = new TacticalGoalsEnum(14, "Apoyos");
        public static TacticalGoalsEnum Offensive = new TacticalGoalsEnum(15, "Ataque");
        public static TacticalGoalsEnum CounterAttack = new TacticalGoalsEnum(16, "Contraataque");
        public static TacticalGoalsEnum TimmingPlay = new TacticalGoalsEnum(17, "Ritmo de juego");
        public static TacticalGoalsEnum ChangesInPace = new TacticalGoalsEnum(18, "Cambios de ritmo");
        public static TacticalGoalsEnum BallPreservation = new TacticalGoalsEnum(19, "Conservación de balón");
        public static TacticalGoalsEnum ChangesOrientation = new TacticalGoalsEnum(20, "Cambios de orientación");
        public static TacticalGoalsEnum Progression = new TacticalGoalsEnum(21, "Progresión");

        public int Id { get; private set; }
        public string Name { get; private set; }
        private TacticalGoalsEnum(int id, string name)
        {
            Id = id;
            Name = name;
        }
        public static IEnumerable<TacticalGoalsEnum> List() =>
             new[]
             {
                 Mark, Retread, Coverage, Swap, DefensiveSurveillance, Timing, Tackle, Charge, Anticipate, Interception,
                 Pressing, PressingAfterLosingPossesion, UnMarks, OffensiveSupports, Offensive, CounterAttack,
                    TimmingPlay, ChangesInPace, BallPreservation, ChangesOrientation, Progression
             };
        public static TacticalGoalsEnum FromName(string name) =>
            List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase))
                ?? throw new ArgumentException($"Possible values for TacticalGoals: {string.Join(",", List().Select(s => s.Name))}");
        public static TacticalGoalsEnum From(int id) =>
            List().SingleOrDefault(s => s.Id == id)
                ?? throw new ArgumentException($"Possible values for TacticalGoals: {string.Join(",", List().Select(s => s.Name))}");
    }
}
