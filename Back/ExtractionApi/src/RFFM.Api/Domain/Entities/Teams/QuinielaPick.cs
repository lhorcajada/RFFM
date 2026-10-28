namespace RFFM.Api.Domain.Entities.Teams
{
    /// <summary>Pronóstico de un partido dentro de un boleto (owned por <see cref="QuinielaTicket"/>).</summary>
    public sealed record QuinielaPick(string RecordCode, QuinielaSign Sign);
}
