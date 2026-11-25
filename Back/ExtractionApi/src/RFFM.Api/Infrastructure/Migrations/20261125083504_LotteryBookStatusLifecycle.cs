using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LotteryBookStatusLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "TeamPlayerId",
                schema: "app",
                table: "LotteryBooks",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "DeliveredOn",
                schema: "app",
                table: "LotteryBooks",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddColumn<DateOnly>(
                name: "ClubDeliveredOn",
                schema: "app",
                table: "LotteryBooks",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LastTicketNumber",
                schema: "app",
                table: "LotteryBooks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                schema: "app",
                table: "LotteryBooks",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE app."LotteryBooks" AS b
                SET "LastTicketNumber" = b."FirstTicketNumber" + c."TicketsPerBook" - 1,
                    "Status" = CASE WHEN b."AmountReturned" IS NOT NULL THEN 'ReturnedToCoach' ELSE 'DeliveredToPlayer' END
                FROM app."LotteryCampaigns" AS c
                WHERE c."Id" = b."LotteryCampaignId";
                """);

            migrationBuilder.Sql("""
                UPDATE app."LotteryBooks" AS b
                SET "Status" = 'DeliveredToClub',
                    "ClubDeliveredOn" = c."ClubDeliveredOn"
                FROM app."LotteryCampaigns" AS c
                WHERE c."Id" = b."LotteryCampaignId"
                  AND c."ClubDeliveredOn" IS NOT NULL
                  AND b."AmountReturned" IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "ClubDeliveredAmount",
                schema: "app",
                table: "LotteryCampaigns");

            migrationBuilder.DropColumn(
                name: "ClubDeliveredOn",
                schema: "app",
                table: "LotteryCampaigns");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ClubDeliveredAmount",
                schema: "app",
                table: "LotteryCampaigns",
                type: "numeric(10,2)",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ClubDeliveredOn",
                schema: "app",
                table: "LotteryCampaigns",
                type: "date",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE app."LotteryCampaigns" AS c
                SET "ClubDeliveredOn" = s."LastDeliveredOn",
                    "ClubDeliveredAmount" = s."AmountDelivered"
                FROM (
                    SELECT "LotteryCampaignId",
                           MAX("ClubDeliveredOn") AS "LastDeliveredOn",
                           SUM(COALESCE("AmountReturned", 0)) AS "AmountDelivered"
                    FROM app."LotteryBooks"
                    WHERE "Status" = 'DeliveredToClub'
                    GROUP BY "LotteryCampaignId"
                ) AS s
                WHERE s."LotteryCampaignId" = c."Id";
                """);

            migrationBuilder.Sql("""DELETE FROM app."LotteryBooks" WHERE "TeamPlayerId" IS NULL;""");

            migrationBuilder.Sql("""UPDATE app."LotteryBooks" SET "DeliveredOn" = CURRENT_DATE WHERE "DeliveredOn" IS NULL;""");

            migrationBuilder.DropColumn(
                name: "ClubDeliveredOn",
                schema: "app",
                table: "LotteryBooks");

            migrationBuilder.DropColumn(
                name: "LastTicketNumber",
                schema: "app",
                table: "LotteryBooks");

            migrationBuilder.DropColumn(
                name: "Status",
                schema: "app",
                table: "LotteryBooks");

            migrationBuilder.AlterColumn<string>(
                name: "TeamPlayerId",
                schema: "app",
                table: "LotteryBooks",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<DateOnly>(
                name: "DeliveredOn",
                schema: "app",
                table: "LotteryBooks",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1),
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }
    }
}
