namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// One team of an exercise sheet ("Jugadores"): its palette color, name, number of players, roles
    /// as free text and its objective lines. The sheet's "objective of each team" block is built from
    /// <see cref="Objetivos"/>. Serialized as jsonb — see <c>TaskTrainingBaseEntityConfiguration</c>.
    /// </summary>
    /// <param name="Color">One of <see cref="Colors"/>, or null when the team has no color.</param>
    public sealed record ExerciseTeam(string? Color, string Nombre, int? Cantidad, string? Roles, List<string> Objetivos)
    {
        public const string Blue = "blue";
        public const string Yellow = "yellow";
        public const string Gray = "gray";

        public static readonly IReadOnlySet<string> Colors = new HashSet<string> { Blue, Yellow, Gray };
    }
}
