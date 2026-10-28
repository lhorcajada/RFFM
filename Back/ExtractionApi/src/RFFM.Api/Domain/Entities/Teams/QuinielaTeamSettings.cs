namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>
    /// Ajustes de la quiniela de un equipo. Único por TeamId. Sin fila se aplica <see cref="DefaultFundPercent"/>.
    /// </summary>
    public class QuinielaTeamSettings : BaseEntity
    {
        public const decimal DefaultFundPercent = 0m;

        public string TeamId { get; private set; } = null!;

        /// <summary>Porcentaje de lo cobrado que va al fondo del equipo; el resto es la bolsa de premios.</summary>
        public decimal FundPercent { get; private set; }

        public decimal PrizePercent => 100m - FundPercent;

        private QuinielaTeamSettings() { }

        public static QuinielaTeamSettings Create(string teamId, decimal fundPercent)
        {
            if (string.IsNullOrWhiteSpace(teamId))
                throw new ArgumentException("teamId cannot be empty.", nameof(teamId));

            var settings = new QuinielaTeamSettings { TeamId = teamId };
            settings.UpdateFundPercent(fundPercent);
            return settings;
        }

        public void UpdateFundPercent(decimal fundPercent)
        {
            if (fundPercent is < 0 or > 100)
                throw new DomainException("Quiniela", "El porcentaje para el fondo debe estar entre 0 y 100.", ErrorCodes.QuinielaInvalidJornada);

            FundPercent = fundPercent;
        }
    }
}
