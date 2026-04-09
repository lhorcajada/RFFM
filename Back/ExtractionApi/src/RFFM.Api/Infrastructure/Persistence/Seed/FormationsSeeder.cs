using Microsoft.EntityFrameworkCore;
using RFFM.Api.Domain.Entities.Formations;

namespace RFFM.Api.Infrastructure.Persistence.Seed
{
    public static class FormationsSeeder
    {
        private static readonly (string Name, string Description)[] Formations =
        [
            ("4-4-2",       "Cuatro defensas, cuatro centrocampistas, dos delanteros"),
            ("4-3-3",       "Cuatro defensas, tres centrocampistas, tres delanteros"),
            ("4-2-3-1",     "Cuatro defensas, dos pivotes, tres mediapuntas, un delantero"),
            ("4-3-2-1",     "Árbol de navidad: cuatro defensas, tres medios, dos mediapuntas, un ariete"),
            ("4-5-1",       "Cuatro defensas, cinco centrocampistas, un delantero"),
            ("4-1-4-1",     "Cuatro defensas, un pivote defensivo, cuatro medios, un delantero"),
            ("4-4-1-1",     "Cuatro defensas, cuatro medios, un mediapunta, un delantero"),
            ("3-5-2",       "Tres centrales, cinco centrocampistas (con carrileros), dos delanteros"),
            ("3-4-3",       "Tres centrales, cuatro centrocampistas, tres delanteros"),
            ("3-6-1",       "Tres centrales, seis centrocampistas, un delantero"),
            ("3-4-2-1",     "Tres centrales, cuatro medios, dos mediapuntas, un ariete"),
            ("5-3-2",       "Cinco defensas (con carrileros), tres medios, dos delanteros"),
            ("5-4-1",       "Cinco defensas (con carrileros), cuatro medios, un delantero"),
            ("5-2-3",       "Cinco defensas (con carrileros), dos medios, tres delanteros"),
            ("4-1-2-1-2",   "Diamante: cuatro defensas, pivote, dos medios, mediapunta, dos delanteros"),
            ("4-2-2-2",     "Cuatro defensas, dos pivotes, dos mediapuntas, dos delanteros"),
            ("4-3-1-2",     "Cuatro defensas, tres medios, un mediapunta, dos delanteros"),
            ("3-3-3-1",     "Tres líneas de tres jugadores más un ariete"),
        ];

        public static async Task SeedAsync(AppDbContext context, CancellationToken cancellationToken = default)
        {
            if (await context.Formations.AnyAsync(cancellationToken))
                return;

            var formations = Formations
                .Select(f => Formation.Create(f.Name, f.Description))
                .ToArray();

            context.Formations.AddRange(formations);
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
