using System;

namespace RFFM.Api.Tests.Fixtures
{
    /// <summary>Reloj fijo para tests deterministas.</summary>
    public sealed class FixedTimeProvider(DateTime utcNow) : TimeProvider
    {
        private readonly DateTimeOffset _utcNow = new(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));

        public override DateTimeOffset GetUtcNow() => _utcNow;
    }
}
