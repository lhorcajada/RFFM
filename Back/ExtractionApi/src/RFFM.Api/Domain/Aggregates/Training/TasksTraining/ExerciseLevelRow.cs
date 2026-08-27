namespace RFFM.Api.Domain.Aggregates.Training.TasksTraining
{
    /// <summary>
    /// One row of an exercise's "Niveles" table (reduced template § Niveles): a level number
    /// plus a free-text value per coach-defined "palanca" column (keyed by column name, see
    /// <see cref="TaskTrainingBase.NivelesColumnas"/>). Serialized as jsonb — see
    /// <c>TaskTrainingBaseEntityConfiguration</c>.
    /// </summary>
    public sealed record ExerciseLevelRow(int Nivel, Dictionary<string, string> Valores);
}
