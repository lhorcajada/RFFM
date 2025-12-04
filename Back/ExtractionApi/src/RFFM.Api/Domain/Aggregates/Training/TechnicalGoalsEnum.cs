namespace RFFM.Api.Domain.Aggregates.Training
{
    public class TechnicalGoalsEnum
    {
        public static TechnicalGoalsEnum BallControl = new TechnicalGoalsEnum(1, "Control");
        public static TechnicalGoalsEnum Passing = new TechnicalGoalsEnum(2, "Pase");
        public static TechnicalGoalsEnum Dribbling = new TechnicalGoalsEnum(3, "Regate");
        public static TechnicalGoalsEnum Shooting = new TechnicalGoalsEnum(4, "Tiro");
        public static TechnicalGoalsEnum Heading = new TechnicalGoalsEnum(5, "Cabeza");
        public static TechnicalGoalsEnum Robo = new TechnicalGoalsEnum(6, "Robo");
        public static TechnicalGoalsEnum Driving = new TechnicalGoalsEnum(7, "Conducción");
        public static TechnicalGoalsEnum Enter = new TechnicalGoalsEnum(8, "Entrada");

        public int Id { get; private set; }
        public string Name { get; private set; }
        private TechnicalGoalsEnum(int id, string name)
        {
            Id = id;
            Name = name;
        }

        public static IEnumerable<TechnicalGoalsEnum> List() =>
             new[] { BallControl, Passing, Dribbling, Shooting, Heading, Robo, Driving, Enter };
        public static TechnicalGoalsEnum FromName(string name) =>
            List()
                .SingleOrDefault(s => string.Equals(s.Name, name, StringComparison.CurrentCultureIgnoreCase))
                ?? throw new ArgumentException($"Possible values for TechnicalGoals: {string.Join(",", List().Select(s => s.Name))}");
        public static TechnicalGoalsEnum From(int id) =>
            List().SingleOrDefault(s => s.Id == id)
                ?? throw new ArgumentException($"Possible values for TechnicalGoals: {string.Join(",", List().Select(s => s.Name))}");
    }
}
