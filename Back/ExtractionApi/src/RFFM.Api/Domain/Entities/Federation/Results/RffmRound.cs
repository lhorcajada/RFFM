namespace RFFM.Api.Domain.Entities.Federation.Results
{
    public record RoundSyncResult(bool Changed, IReadOnlyList<string> NewlyFinalRecordCodes);

    public class RffmRound : BaseEntity
    {
        public static class Rules
        {
            public const int GroupCodeMaxLength = 50;
            public const int NameMaxLength = 100;
        }

        private readonly List<RffmMatch> _matches = new();

        public string GroupCode { get; private set; } = null!;
        public int Number { get; private set; }
        public string Name { get; private set; } = string.Empty;
        public DateOnly? Date { get; private set; }
        public DateTime? LastSyncedAt { get; private set; }

        public IReadOnlyCollection<RffmMatch> Matches => _matches.AsReadOnly();

        private RffmRound() { }

        public static RffmRound Create(string groupCode, int number, string name, DateOnly? date)
        {
            if (string.IsNullOrWhiteSpace(groupCode))
                throw new ArgumentException("El grupo es obligatorio.");
            if (number <= 0)
                throw new ArgumentException("La jornada debe ser mayor que 0.");

            return new RffmRound
            {
                GroupCode = groupCode.Trim(),
                Number = number,
                Name = (name ?? string.Empty).Trim(),
                Date = date
            };
        }

        public void UpdateInfo(string name, DateOnly? date)
        {
            Name = (name ?? string.Empty).Trim();
            Date = date;
        }

        /// <summary>
        /// Aplica los partidos descargados de la RFFM. Una jornada vacía no borra los partidos guardados
        /// (la RFFM devuelve a veces respuestas vacías).
        /// </summary>
        public RoundSyncResult ApplySnapshot(IEnumerable<RffmMatchSnapshot> matches, DateTime syncedAt)
        {
            var snapshots = matches
                .Where(m => !string.IsNullOrWhiteSpace(m.RecordCode))
                .GroupBy(m => m.RecordCode.Trim())
                .Select(g => g.First())
                .ToList();

            LastSyncedAt = syncedAt;
            if (snapshots.Count == 0)
                return new RoundSyncResult(false, []);

            var changed = false;
            var newlyFinal = new List<string>();

            foreach (var (snapshot, index) in snapshots.Select((s, i) => (s, i)))
            {
                var recordCode = snapshot.RecordCode.Trim();
                var existing = _matches.FirstOrDefault(m => m.RecordCode == recordCode);
                var wasFinal = existing?.IsFinal ?? false;

                if (existing == null)
                {
                    existing = RffmMatch.Create(Id, snapshot, syncedAt);
                    _matches.Add(existing);
                    changed = true;
                }
                else if (existing.Apply(snapshot, syncedAt))
                {
                    changed = true;
                }

                existing.SetSortOrder(index);
                if (existing.IsFinal && !wasFinal)
                    newlyFinal.Add(recordCode);
            }

            var receivedCodes = snapshots.Select(s => s.RecordCode.Trim()).ToHashSet();
            var removed = _matches.RemoveAll(m => !receivedCodes.Contains(m.RecordCode));

            return new RoundSyncResult(changed || removed > 0, newlyFinal);
        }
    }
}
