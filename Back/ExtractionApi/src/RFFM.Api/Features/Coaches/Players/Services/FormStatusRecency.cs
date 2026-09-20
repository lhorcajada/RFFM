namespace RFFM.Api.Features.Coaches.Players.Services
{
    /// <summary>
    /// Peso de recencia de un evento para Estado de forma. Curva propia (distinta del decaimiento
    /// de Cansancio): mide forma acumulada, no fatiga aguda.
    /// See openspec/changes/player-form-status-received-offered-load/design.md → Decisión 2.
    /// </summary>
    public static class FormStatusRecency
    {
        // Ventana total de 6 semanas; lo anterior no cuenta.
        public const int WindowDays = 42;

        // Semana de gracia: una semana sin actividad no resta, porque los eventos recientes pesan
        // igual en numerador y denominador del ratio.
        public const int RecencyFullWeightDays = 7;

        // Pasada la gracia, el peso se reduce a la mitad cada 14 días: lo antiguo se diluye rápido
        // y el destreno se nota.
        public const int RecencyHalfLifeDays = 14;

        public static double Weight(int daysAgo) =>
            daysAgo <= RecencyFullWeightDays
                ? 1.0
                : Math.Pow(0.5, (double)(daysAgo - RecencyFullWeightDays) / RecencyHalfLifeDays);
    }
}
