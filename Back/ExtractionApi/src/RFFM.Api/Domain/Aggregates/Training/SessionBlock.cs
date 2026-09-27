namespace RFFM.Api.Domain.Aggregates.Training
{
    /// <summary>
    /// One "Bloque N — [nombre]" of a <see cref="TrainingSession"/> (reduced template §
    /// Plantilla-Sesion.md): optionally a rotation narrative (meaningful only when it has more
    /// than one exercise "en paralelo"), and an ordered list of <see cref="SessionBlockExercise"/>.
    /// </summary>
    public class SessionBlock : BaseEntity
    {
        public string TrainingSessionId { get; private set; } = null!;
        public int Order { get; private set; }
        public string Nombre { get; private set; } = null!;
        public string? RotacionEntreEjercicios { get; private set; }
        public List<SessionBlockExercise> Exercises { get; private set; } = new();

        private SessionBlock() { }

        public SessionBlock(string trainingSessionId, int order, string nombre, string? rotacionEntreEjercicios)
        {
            if (string.IsNullOrWhiteSpace(trainingSessionId))
                throw new ArgumentException("TrainingSessionId cannot be empty.", nameof(trainingSessionId));
            if (string.IsNullOrWhiteSpace(nombre))
                throw new ArgumentException("Nombre cannot be empty.", nameof(nombre));

            TrainingSessionId = trainingSessionId;
            Order = order;
            Nombre = nombre.Trim();
            RotacionEntreEjercicios = string.IsNullOrWhiteSpace(rotacionEntreEjercicios) ? null : rotacionEntreEjercicios.Trim();
        }

        /// <summary>Clears and rebuilds <see cref="Exercises"/> wholesale — same "trust
        /// server-derived state" approach used across this codebase.</summary>
        public void ReplaceExercises(IEnumerable<(string ExerciseId, int Position)> exercises)
        {
            Exercises.Clear();
            foreach (var exercise in exercises)
                Exercises.Add(new SessionBlockExercise(Id, exercise.ExerciseId, exercise.Position));
        }
    }
}
