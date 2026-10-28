using Ardalis.SmartEnum;

namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>Signo de un partido: 1 (gana el local), X (empate), 2 (gana el visitante).</summary>
    public sealed class QuinielaSign : SmartEnum<QuinielaSign>
    {
        public static readonly QuinielaSign Home = new("1", 1);
        public static readonly QuinielaSign Draw = new("X", 2);
        public static readonly QuinielaSign Away = new("2", 3);

        private QuinielaSign(string name, int value) : base(name, value) { }

        public static QuinielaSign FromGoals(int homeGoals, int awayGoals) =>
            homeGoals > awayGoals ? Home : homeGoals == awayGoals ? Draw : Away;
    }

    /// <summary>Categoría de premio. <see cref="None"/> = sin premio.</summary>
    public sealed class QuinielaCategory : SmartEnum<QuinielaCategory>
    {
        public static readonly QuinielaCategory None = new(nameof(None), 0);
        public static readonly QuinielaCategory Special = new(nameof(Special), 1);
        public static readonly QuinielaCategory First = new(nameof(First), 2);
        public static readonly QuinielaCategory Second = new(nameof(Second), 3);
        public static readonly QuinielaCategory Third = new(nameof(Third), 4);

        private QuinielaCategory(string name, int value) : base(name, value) { }
    }

    /// <summary><see cref="Expired"/> es derivado (Pending pasado el plazo) y nunca se persiste.</summary>
    public sealed class QuinielaPaymentStatus : SmartEnum<QuinielaPaymentStatus>
    {
        public static readonly QuinielaPaymentStatus Pending = new(nameof(Pending), 1);
        public static readonly QuinielaPaymentStatus Paid = new(nameof(Paid), 2);
        public static readonly QuinielaPaymentStatus Expired = new(nameof(Expired), 3);

        private QuinielaPaymentStatus(string name, int value) : base(name, value) { }
    }

    public sealed class QuinielaPaymentMethod : SmartEnum<QuinielaPaymentMethod>
    {
        public static readonly QuinielaPaymentMethod Cash = new(nameof(Cash), 1);
        public static readonly QuinielaPaymentMethod Bizum = new(nameof(Bizum), 2);

        private QuinielaPaymentMethod(string name, int value) : base(name, value) { }
    }

    public sealed class QuinielaJornadaStatus : SmartEnum<QuinielaJornadaStatus>
    {
        public static readonly QuinielaJornadaStatus Open = new(nameof(Open), 1);
        public static readonly QuinielaJornadaStatus Settled = new(nameof(Settled), 2);

        private QuinielaJornadaStatus(string name, int value) : base(name, value) { }
    }
}
