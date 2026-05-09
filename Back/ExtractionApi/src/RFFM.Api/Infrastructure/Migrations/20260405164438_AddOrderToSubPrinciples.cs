using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderToSubPrinciples : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'app' AND table_name = 'SubSubPrinciples' AND column_name = 'Order'
                    ) THEN
                        ALTER TABLE app.""SubSubPrinciples"" ADD COLUMN ""Order"" integer NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            ");

            migrationBuilder.Sql(@"
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = 'app' AND table_name = 'SubPrinciples' AND column_name = 'Order'
                    ) THEN
                        ALTER TABLE app.""SubPrinciples"" ADD COLUMN ""Order"" integer NOT NULL DEFAULT 0;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"ALTER TABLE app.""SubSubPrinciples"" DROP COLUMN IF EXISTS ""Order"";");
            migrationBuilder.Sql(@"ALTER TABLE app.""SubPrinciples"" DROP COLUMN IF EXISTS ""Order"";");
        }
    }
}
