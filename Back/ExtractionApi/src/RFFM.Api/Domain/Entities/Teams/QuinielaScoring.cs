namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Servicio de dominio puro: aciertos, categorías y reparto de premios de una jornada.
    /// See openspec/changes/quiniela-team-pool/design.md → D2, D5.
    /// </summary>
    public static class QuinielaScoring
    {
        private const string Title = "Quiniela";

        public sealed record MatchInfo(string RecordCode, bool IsValid, DateTime? Kickoff, int SortOrder,
            int? HomeGoals, int? AwayGoals);

        public sealed record TicketScore(string TicketId, int Hits, QuinielaCategory Category, decimal Prize);

        public sealed record Result(
            decimal Collected,
            decimal PrizePool,
            decimal FundAmount,
            decimal CarryOut,
            IReadOnlyList<TicketScore> Tickets);

        // Pesos oficiales de La Quiniela (Especial 7,5 / 1ª 16 / 2ª 7,5 / 3ª 7,5) para las cuatro categorías
        // del equipo, reescalados para repartir el 55 % de lo recaudado. Ver design.md D5.
        private const decimal SpecialWeight = 7.5m;
        private const decimal FirstWeight = 16m;
        private const decimal SecondWeight = 7.5m;
        private const decimal ThirdWeight = 7.5m;

        public const decimal TotalWeight = SpecialWeight + FirstWeight + SecondWeight + ThirdWeight;

        public static decimal WeightFor(QuinielaCategory category) =>
            category == QuinielaCategory.Special ? SpecialWeight
            : category == QuinielaCategory.First ? FirstWeight
            : category == QuinielaCategory.Second ? SecondWeight
            : category == QuinielaCategory.Third ? ThirdWeight
            : 0m;

        private sealed class PrizeGroup(decimal fund, List<string> winnerIds)
        {
            public decimal Fund { get; set; } = fund;
            public List<string> WinnerIds { get; } = winnerIds;
            public decimal Unit => FloorToCent(Fund / WinnerIds.Count);
        }

        /// <summary>
        /// Solo los boletos pagados (<see cref="QuinielaPaymentStatus.Paid"/>) se cobran y entran en el reparto;
        /// los pendientes/expirados reciben categoría None y premio 0. Bolsa = cobrado × prizePercent + carryIn;
        /// cada categoría recibe bolsa × peso / <see cref="TotalWeight"/>, repartido a partes iguales y truncado
        /// al céntimo. Especial y 1ª desiertas, la 3ª desierta y los restos pasan al bote; la 2ª desierta suma su
        /// importe a la 3ª. Un premio nunca supera al de una categoría superior: si lo hiciera, se juntan los
        /// fondos y se reparten entre los acertantes de ambas.
        /// </summary>
        public static Result Score(IReadOnlyCollection<MatchInfo> matches, IReadOnlyCollection<QuinielaTicket> tickets,
            decimal price, decimal prizePercent, decimal carryIn)
        {
            var validMatches = matches.Where(m => m.IsValid).ToList();
            if (validMatches.Count == 0)
                throw new DomainException(Title, "No hay partidos válidos en la jornada.", ErrorCodes.QuinielaNoValidMatches);
            if (validMatches.Any(m => m.HomeGoals is null || m.AwayGoals is null))
                throw new DomainException(Title, "Hay partidos válidos sin resultado.", ErrorCodes.QuinielaMatchesNotFinished);

            var pleno = PlenoMatch(validMatches);
            var plenoHome = Math.Min(pleno.HomeGoals!.Value, QuinielaTicket.Rules.MaxPlenoGoals);
            var plenoAway = Math.Min(pleno.AwayGoals!.Value, QuinielaTicket.Rules.MaxPlenoGoals);
            var outcomes = validMatches.ToDictionary(m => m.RecordCode,
                m => QuinielaSign.FromGoals(m.HomeGoals!.Value, m.AwayGoals!.Value));

            var scored = tickets.Select(t =>
            {
                var hits = t.Picks.Count(p => outcomes.TryGetValue(p.RecordCode, out var sign) && sign == p.Sign);
                var isPaid = t.PaymentStatus == QuinielaPaymentStatus.Paid;
                var category = isPaid
                    ? CategoryFor(validMatches.Count - hits, t.PlenoHome == plenoHome && t.PlenoAway == plenoAway)
                    : QuinielaCategory.None;
                return (Ticket: t, Hits: hits, Category: category, IsPaid: isPaid);
            }).ToList();

            var collected = scored.Count(s => s.IsPaid) * price;
            var prizeBase = FloorToCent(collected * prizePercent / 100m);
            var fundAmount = collected - prizeBase;
            var prizePool = prizeBase + carryIn;

            decimal FundOf(QuinielaCategory category) => FloorToCent(prizePool * WeightFor(category) / TotalWeight);
            List<string> WinnersOf(QuinielaCategory category) =>
                scored.Where(s => s.Category == category).Select(s => s.Ticket.Id).ToList();

            var groups = new List<PrizeGroup>();
            var secondFundForThird = 0m;
            foreach (var category in new[] { QuinielaCategory.Special, QuinielaCategory.First, QuinielaCategory.Second, QuinielaCategory.Third })
            {
                var winners = WinnersOf(category);
                var fund = FundOf(category);
                if (category == QuinielaCategory.Third)
                    fund += secondFundForThird;

                if (winners.Count == 0)
                {
                    if (category == QuinielaCategory.Second)
                        secondFundForThird = fund;
                    continue;
                }

                var group = new PrizeGroup(fund, winners);
                while (groups.Count > 0 && group.Unit > groups[^1].Unit)
                {
                    var higher = groups[^1];
                    groups.RemoveAt(groups.Count - 1);
                    group.Fund += higher.Fund;
                    group.WinnerIds.AddRange(higher.WinnerIds);
                }
                groups.Add(group);
            }

            var prizes = groups
                .SelectMany(g => g.WinnerIds.Select(id => (Id: id, g.Unit)))
                .ToDictionary(x => x.Id, x => x.Unit);

            var results = scored
                .Select(s => new TicketScore(s.Ticket.Id, s.Hits, s.Category, prizes.GetValueOrDefault(s.Ticket.Id)))
                .ToList();
            var carryOut = prizePool - results.Sum(r => r.Prize);

            return new Result(collected, prizePool, fundAmount, carryOut, results);
        }

        /// <summary>El Pleno es el último partido válido por fecha y hora (desempate por orden en la jornada).</summary>
        public static MatchInfo PlenoMatch(IEnumerable<MatchInfo> validMatches) =>
            validMatches.OrderBy(m => m.Kickoff ?? DateTime.MinValue).ThenBy(m => m.SortOrder).Last();

        private static QuinielaCategory CategoryFor(int misses, bool plenoExact) => misses switch
        {
            0 when plenoExact => QuinielaCategory.Special,
            0 => QuinielaCategory.First,
            1 => QuinielaCategory.Second,
            2 => QuinielaCategory.Third,
            _ => QuinielaCategory.None
        };

        private static decimal FloorToCent(decimal value) => Math.Floor(value * 100m) / 100m;
    }
}
