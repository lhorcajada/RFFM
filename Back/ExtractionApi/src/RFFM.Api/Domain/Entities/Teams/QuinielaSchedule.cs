namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>Cálculos de horario de la quiniela en hora de Madrid (las horas de la RFFM son locales).</summary>
    public static class QuinielaSchedule
    {
        private static readonly TimeZoneInfo Madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        public static DateTime KickoffUtc(DateOnly date, TimeOnly time) =>
            TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(time, DateTimeKind.Unspecified), Madrid);

        /// <summary>
        /// Primer instante en que el plazo de pago ya ha vencido: sábado 00:00 de Madrid, es decir, justo
        /// después del viernes 23:59 de la semana (lunes-domingo) del primer partido. Un boleto pendiente
        /// con <c>now &gt;= PaymentDeadlineUtc</c> está expirado.
        /// </summary>
        public static DateTime PaymentDeadlineUtc(DateOnly firstMatchDate)
        {
            var daysSinceMonday = ((int)firstMatchDate.DayOfWeek + 6) % 7;
            var friday = firstMatchDate.AddDays(4 - daysSinceMonday);
            return KickoffUtc(friday.AddDays(1), TimeOnly.MinValue);
        }
    }
}
