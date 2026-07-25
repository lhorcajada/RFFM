using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    public static class ExerciseTypesSeeder
    {
        public static readonly string[] Types = ["Physical", "Technical", "Tactical", "Game", "Cognitive", "Psychological"];

        public static async Task SeedAsync(AppDbContext context, CancellationToken cancellationToken = default)
        {
            if (await context.ExerciseTypes.AnyAsync(cancellationToken))
                return;

            context.ExerciseTypes.AddRange(Types.Select(ExerciseType.Create));
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
