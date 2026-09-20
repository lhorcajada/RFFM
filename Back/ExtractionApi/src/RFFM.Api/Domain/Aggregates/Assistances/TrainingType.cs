namespace RFFM.Api.Domain.Aggregates.Assistances
{
    public class TrainingType
    {
        public static readonly TrainingType Fisico = new TrainingType("Fisico", "Físico");
        public static readonly TrainingType Tecnico = new TrainingType("Tecnico", "Técnico");
        public static readonly TrainingType Tactico = new TrainingType("Tactico", "Táctico");

        public string Code { get; private set; }
        public string Name { get; private set; }

        private TrainingType(string code, string name)
        {
            Code = code;
            Name = name;
        }

        public static IEnumerable<TrainingType> List() => new[] { Fisico, Tecnico, Tactico };

        public static bool IsValidCode(string? code) =>
            !string.IsNullOrEmpty(code) && List().Any(t => string.Equals(t.Code, code, StringComparison.Ordinal));
    }
}
