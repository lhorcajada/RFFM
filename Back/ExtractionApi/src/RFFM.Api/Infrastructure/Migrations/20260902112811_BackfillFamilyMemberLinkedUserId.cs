using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <summary>
    /// Data-only backfill (no schema change) for TeamPlayerFamilyMember.LinkedUserId.
    ///
    /// Before the family-member-coach-registration openspec change, a family member could
    /// already self-register through the pre-existing generic flow (CreateUser.Handler,
    /// IsFamilyMember branch) using the player's PlayerLinkCode: it creates the IdentityUser
    /// and a UserTeam (RoleId = Membership.FamilyPlayer.Id) linked to the TeamPlayer, but only
    /// calls TeamPlayerFamilyMember.AddFamilyMemberEmailIfMissing — it never set LinkedUserId
    /// (that column/method only exists since the newer Register/Approve flow). GetTeamPlayer's
    /// RegistrationStatus mapping treats LinkedUserId == null as "None", so every family member
    /// who registered through the old flow shows up as unregistered even though they already
    /// have a working account.
    ///
    /// This migration backfills LinkedUserId for exactly that case: a TeamPlayerFamilyMember row
    /// with no LinkedUserId yet, whose Email matches (case-insensitively) the Email of an
    /// AspNetUsers row that is already linked, via UserTeams, as a FamilyPlayer to that same
    /// TeamPlayer.
    ///
    /// Implemented as a single cross-schema SQL UPDATE (not a C# seeder/hosted service) because
    /// AppDbContext, IdentityDbContext and FederationDbContext all resolve the SAME physical
    /// PostgreSQL database via the single "FutbolBaseConnection" connection string
    /// (ServiceCollectionExtensions.cs) — they only differ by schema/migrations-history-table —
    /// so a plain JOIN across app.* and identity.* works directly inside this AppDbContext
    /// migration, exactly like the existing precedent for raw-SQL migrations
    /// (20260709120000_AddUserTeam.cs). No separate connection or startup ordering is needed.
    ///
    /// Idempotent: the WHERE clause only ever targets rows where "LinkedUserId" IS NULL, so
    /// re-running this migration (or the underlying UPDATE) is a no-op once applied.
    /// </summary>
    public partial class BackfillFamilyMemberLinkedUserId : Migration
    {
        /// <summary>
        /// Exposed as a constant (rather than inlined only in <see cref="Up"/>) so tests can
        /// execute the exact same statement against arbitrary fixture data instead of only being
        /// able to assert on whatever happened to exist in the database at fixture-migration
        /// time (see BackfillFamilyMemberLinkedUserIdTests).
        /// </summary>
        public const string BackfillSql = @"
            UPDATE app.""TeamPlayerFamilies"" AS fam
            SET ""LinkedUserId"" = matched.""ApplicationUserId""
            FROM (
                SELECT DISTINCT ON (ut.""LinkedTeamPlayerId"", u.""Email"")
                    ut.""LinkedTeamPlayerId"" AS ""TeamPlayerId"",
                    u.""Email"" AS ""Email"",
                    ut.""ApplicationUserId"" AS ""ApplicationUserId""
                FROM app.""UserTeams"" ut
                INNER JOIN identity.""AspNetUsers"" u ON u.""Id"" = ut.""ApplicationUserId""
                WHERE ut.""RoleId"" = 5 -- Membership.FamilyPlayer.Id
                  AND ut.""LinkedTeamPlayerId"" IS NOT NULL
                  AND u.""Email"" IS NOT NULL
            ) AS matched
            WHERE fam.""LinkedUserId"" IS NULL
              AND fam.""Email"" IS NOT NULL
              AND fam.""TeamPlayerId"" = matched.""TeamPlayerId""
              AND LOWER(fam.""Email"") = LOWER(matched.""Email"");
        ";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Guarded with a table-existence check: Program.cs applies AppDbContext's pending
            // migrations (this one included) BEFORE IdentityDbContext's on a first-ever deploy
            // (await app.MigrateDbContext<AppDbContext>(); then <IdentityDbContext>()), so on a
            // brand-new environment identity."AspNetUsers" (and even app."UserTeams", for a
            // database created before AddUserTeam) may not exist yet when this migration runs.
            // A fresh environment has no pre-existing family-member accounts to backfill anyway,
            // so skipping in that case is correct — not just crash-avoidance.
            migrationBuilder.Sql($@"
                DO $do$
                BEGIN
                    IF to_regclass('identity.""AspNetUsers""') IS NOT NULL
                       AND to_regclass('app.""UserTeams""') IS NOT NULL
                       AND to_regclass('app.""TeamPlayerFamilies""') IS NOT NULL THEN
                        {BackfillSql}
                    END IF;
                END
                $do$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data-only backfill; not reversible (we can't distinguish backfilled rows from
            // rows that were already linked through the newer Register/Approve flow).
        }
    }
}
