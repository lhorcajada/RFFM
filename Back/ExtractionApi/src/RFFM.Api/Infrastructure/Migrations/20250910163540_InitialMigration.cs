using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace RFFM.Api.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "app");

            migrationBuilder.CreateTable(
                name: "AssistanceTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Points = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssistanceTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CategoryGroups",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoryGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConvocationStatuses",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConvocationStatuses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Countries",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Countries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DemarcationMaster",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DemarcationMaster", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Memberships",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Key = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Memberships", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Players",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    UrlPhoto = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Alias = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BirthDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Dni = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Players", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlayTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PointsTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PointsTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Seasons",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Seasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SportEventTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SportEventTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TacticalGoals",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TacticalGoals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TaskTrainingBases",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    PlayersNumber = table.Column<int>(type: "int", nullable: false),
                    GoalPeekersNumber = table.Column<int>(type: "int", nullable: false),
                    DurationTotal = table.Column<int>(type: "int", nullable: false),
                    FieldSpace = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Points = table.Column<int>(type: "int", nullable: false),
                    UrlImage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Discriminator = table.Column<string>(type: "nvarchar(13)", maxLength: 13, nullable: false),
                    Series = table.Column<int>(type: "int", nullable: true),
                    DurationSeries = table.Column<int>(type: "int", nullable: true),
                    RestSeries = table.Column<int>(type: "int", nullable: true),
                    Time = table.Column<TimeSpan>(type: "time", nullable: true),
                    TouchesNumber = table.Column<int>(type: "int", nullable: true),
                    WildCards = table.Column<int>(type: "int", nullable: true),
                    TechnicalTaskTraining_TouchesNumber = table.Column<int>(type: "int", nullable: true),
                    TechnicalTaskTraining_WildCards = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTrainingBases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TechnicalGoals",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechnicalGoals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TechnicalTypes",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TechnicalTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categories",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CategoryGroupId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_CategoryGroups_CategoryGroupId",
                        column: x => x.CategoryGroupId,
                        principalSchema: "app",
                        principalTable: "CategoryGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Clubs",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CountryId = table.Column<int>(type: "int", nullable: false),
                    ShieldUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    InvitationCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Clubs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Clubs_Countries_CountryId",
                        column: x => x.CountryId,
                        principalSchema: "app",
                        principalTable: "Countries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TrainingPointsReports",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TotalPoints = table.Column<int>(type: "int", nullable: false),
                    TrainingNumber = table.Column<int>(type: "int", nullable: false),
                    AssistancePoint = table.Column<int>(type: "int", nullable: false),
                    TecnicalPoints = table.Column<int>(type: "int", nullable: false),
                    AttitudePoints = table.Column<int>(type: "int", nullable: false),
                    TacticalPoints = table.Column<int>(type: "int", nullable: false),
                    PhysicalPoints = table.Column<int>(type: "int", nullable: false),
                    PlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SeasonId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingPointsReports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TrainingPointsReports_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "app",
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TrainingPointsReports_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalSchema: "app",
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Materials",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TaskTrainingBaseId = table.Column<string>(type: "nvarchar(450)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Materials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Materials_TaskTrainingBases_TaskTrainingBaseId",
                        column: x => x.TaskTrainingBaseId,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Technicals",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TechnicalTypeId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Technicals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Technicals_TechnicalTypes_TechnicalTypeId",
                        column: x => x.TechnicalTypeId,
                        principalSchema: "app",
                        principalTable: "TechnicalTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Teams",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    UrlPhoto = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ClubId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SeasonId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Teams", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Teams_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalSchema: "app",
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Teams_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalSchema: "app",
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Teams_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalSchema: "app",
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserClubs",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ApplicationUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    ClubId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    IsCreator = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserClubs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserClubs_Clubs_ClubId",
                        column: x => x.ClubId,
                        principalSchema: "app",
                        principalTable: "Clubs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserClubs_Memberships_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "app",
                        principalTable: "Memberships",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SportEvents",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    EveDateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ArrivalDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Location = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    EventTypeId = table.Column<int>(type: "int", nullable: false),
                    TeamId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TeamId1 = table.Column<string>(type: "nvarchar(450)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SportEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SportEvents_SportEventTypes_EventTypeId",
                        column: x => x.EventTypeId,
                        principalSchema: "app",
                        principalTable: "SportEventTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SportEvents_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SportEvents_Teams_TeamId1",
                        column: x => x.TeamId1,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "TeamPlayers",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TeamId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    JoinedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LeftDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamPlayers_Players_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "app",
                        principalTable: "Players",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamPlayers_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SessionTrainings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    EndTime = table.Column<TimeSpan>(type: "time", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    SportEventId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TeamId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UrlImage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionTrainings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SessionTrainings_SportEvents_SportEventId",
                        column: x => x.SportEventId,
                        principalSchema: "app",
                        principalTable: "SportEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SessionTrainings_Teams_TeamId",
                        column: x => x.TeamId,
                        principalSchema: "app",
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Convocations",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SportEventId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    TeamPlayerId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    AssistanceTypeId = table.Column<int>(type: "int", nullable: false),
                    ResponseDateTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ConvocationStatusId = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Convocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Convocations_AssistanceTypes_AssistanceTypeId",
                        column: x => x.AssistanceTypeId,
                        principalSchema: "app",
                        principalTable: "AssistanceTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Convocations_ConvocationStatuses_ConvocationStatusId",
                        column: x => x.ConvocationStatusId,
                        principalSchema: "app",
                        principalTable: "ConvocationStatuses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Convocations_SportEvents_SportEventId",
                        column: x => x.SportEventId,
                        principalSchema: "app",
                        principalTable: "SportEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Convocations_TeamPlayers_TeamPlayerId",
                        column: x => x.TeamPlayerId,
                        principalSchema: "app",
                        principalTable: "TeamPlayers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaskTrainings",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    SessionTrainingId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskTrainings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskTrainings_SessionTrainings_SessionTrainingId",
                        column: x => x.SessionTrainingId,
                        principalSchema: "app",
                        principalTable: "SessionTrainings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskTrainings_TaskTrainingBases_Id",
                        column: x => x.Id,
                        principalSchema: "app",
                        principalTable: "TaskTrainingBases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConvocationHistories",
                schema: "app",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    ConvocationId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ChangeDateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldStatusId = table.Column<int>(type: "int", nullable: true),
                    NewStatusId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConvocationHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConvocationHistories_Convocations_ConvocationId",
                        column: x => x.ConvocationId,
                        principalSchema: "app",
                        principalTable: "Convocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "AssistanceTypes",
                columns: new[] { "Id", "Name", "Points" },
                values: new object[,]
                {
                    { 1, "Asiste", 5 },
                    { 2, "No asiste con excusa", 0 },
                    { 3, "No asiste sin excusa", 0 },
                    { 4, "Llega tarde", 2 }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "CategoryGroups",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Categoría Nacional" },
                    { 2, "Aficionados" },
                    { 3, "Juveniles" },
                    { 4, "Cadetes" },
                    { 5, "Infantiles" },
                    { 6, "Alevines" },
                    { 7, "Benjamines" },
                    { 8, "Prebenjamines" },
                    { 9, "Debutantes" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "ConvocationStatuses",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Pending" },
                    { 2, "Accepted" },
                    { 3, "Declined" },
                    { 4, "Justified" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "Countries",
                columns: new[] { "Id", "Code", "Name" },
                values: new object[,]
                {
                    { 1, "AF", "Afganistán" },
                    { 2, "AL", "Albania" },
                    { 3, "DE", "Alemania" },
                    { 4, "AD", "Andorra" },
                    { 5, "AO", "Angola" },
                    { 6, "AG", "Antigua y Barbuda" },
                    { 7, "SA", "Arabia Saudita" },
                    { 8, "DZ", "Argelia" },
                    { 9, "AR", "Argentina" },
                    { 10, "AM", "Armenia" },
                    { 11, "AU", "Australia" },
                    { 12, "AT", "Austria" },
                    { 13, "AZ", "Azerbaiyán" },
                    { 14, "BS", "Bahamas" },
                    { 15, "BD", "Bangladés" },
                    { 16, "BB", "Barbados" },
                    { 17, "BH", "Baréin" },
                    { 18, "BE", "Bélgica" },
                    { 19, "BZ", "Belice" },
                    { 20, "BJ", "Benín" },
                    { 21, "BY", "Bielorrusia" },
                    { 22, "MM", "Birmania (Myanmar)" },
                    { 23, "BO", "Bolivia" },
                    { 24, "BA", "Bosnia y Herzegovina" },
                    { 25, "BW", "Botsuana" },
                    { 26, "BR", "Brasil" },
                    { 27, "BN", "Brunéi" },
                    { 28, "BG", "Bulgaria" },
                    { 29, "BF", "Burkina Faso" },
                    { 30, "BI", "Burundi" },
                    { 31, "BT", "Bután" },
                    { 32, "CV", "Cabo Verde" },
                    { 33, "KH", "Camboya" },
                    { 34, "CM", "Camerún" },
                    { 35, "CA", "Canadá" },
                    { 36, "QA", "Catar" },
                    { 37, "TD", "Chad" },
                    { 38, "CL", "Chile" },
                    { 39, "CN", "China" },
                    { 40, "CY", "Chipre" },
                    { 41, "CO", "Colombia" },
                    { 42, "KM", "Comoras" },
                    { 43, "KP", "Corea del Norte" },
                    { 44, "KR", "Corea del Sur" },
                    { 45, "CI", "Costa de Marfil" },
                    { 46, "CR", "Costa Rica" },
                    { 47, "HR", "Croacia" },
                    { 48, "CU", "Cuba" },
                    { 49, "DK", "Dinamarca" },
                    { 50, "DM", "Dominica" },
                    { 51, "EC", "Ecuador" },
                    { 52, "EG", "Egipto" },
                    { 53, "SV", "El Salvador" },
                    { 54, "AE", "Emiratos Árabes Unidos" },
                    { 55, "ER", "Eritrea" },
                    { 56, "SK", "Eslovaquia" },
                    { 57, "SI", "Eslovenia" },
                    { 58, "ES", "España" },
                    { 59, "US", "Estados Unidos" },
                    { 60, "EE", "Estonia" },
                    { 61, "SZ", "Esuatini" },
                    { 62, "ET", "Etiopía" },
                    { 63, "PH", "Filipinas" },
                    { 64, "FI", "Finlandia" },
                    { 65, "FJ", "Fiyi" },
                    { 66, "FR", "Francia" },
                    { 67, "GA", "Gabón" },
                    { 68, "GM", "Gambia" },
                    { 69, "GE", "Georgia" },
                    { 70, "GH", "Ghana" },
                    { 71, "GD", "Granada" },
                    { 72, "GR", "Grecia" },
                    { 73, "GT", "Guatemala" },
                    { 74, "GN", "Guinea" },
                    { 75, "GW", "Guinea-Bisáu" },
                    { 76, "GY", "Guyana" },
                    { 77, "HT", "Haití" },
                    { 78, "HN", "Honduras" },
                    { 79, "HU", "Hungría" },
                    { 80, "IN", "India" },
                    { 81, "ID", "Indonesia" },
                    { 82, "IQ", "Irak" },
                    { 83, "IR", "Irán" },
                    { 84, "IE", "Irlanda" },
                    { 85, "IS", "Islandia" },
                    { 86, "IL", "Israel" },
                    { 87, "IT", "Italia" },
                    { 88, "JM", "Jamaica" },
                    { 89, "JP", "Japón" },
                    { 90, "JO", "Jordania" },
                    { 91, "KZ", "Kazajistán" },
                    { 92, "KE", "Kenia" },
                    { 93, "KG", "Kirguistán" },
                    { 94, "KI", "Kiribati" },
                    { 95, "XK", "Kosovo" },
                    { 96, "KW", "Kuwait" },
                    { 97, "LA", "Laos" },
                    { 98, "LV", "Letonia" },
                    { 99, "LB", "Líbano" },
                    { 100, "LR", "Liberia" },
                    { 101, "LY", "Libia" },
                    { 102, "LI", "Liechtenstein" },
                    { 103, "LT", "Lituania" },
                    { 104, "LU", "Luxemburgo" },
                    { 105, "MG", "Madagascar" },
                    { 106, "MY", "Malasia" },
                    { 107, "MW", "Malaui" },
                    { 108, "MV", "Maldivas" },
                    { 109, "ML", "Malí" },
                    { 110, "MT", "Malta" },
                    { 111, "MA", "Marruecos" },
                    { 112, "MU", "Mauricio" },
                    { 113, "MR", "Mauritania" },
                    { 114, "MX", "México" },
                    { 115, "FM", "Micronesia" },
                    { 116, "MD", "Moldavia" },
                    { 117, "MC", "Mónaco" },
                    { 118, "MN", "Mongolia" },
                    { 119, "ME", "Montenegro" },
                    { 120, "MZ", "Mozambique" },
                    { 121, "NA", "Namibia" },
                    { 122, "NR", "Nauru" },
                    { 123, "NP", "Nepal" },
                    { 124, "NI", "Nicaragua" },
                    { 125, "NE", "Níger" },
                    { 126, "NG", "Nigeria" },
                    { 127, "NO", "Noruega" },
                    { 128, "NZ", "Nueva Zelanda" },
                    { 129, "OM", "Omán" },
                    { 130, "NL", "Países Bajos" },
                    { 131, "PK", "Pakistán" },
                    { 132, "PW", "Palaos" },
                    { 133, "PA", "Panamá" },
                    { 134, "PG", "Papúa Nueva Guinea" },
                    { 135, "PY", "Paraguay" },
                    { 136, "PE", "Perú" },
                    { 137, "PL", "Polonia" },
                    { 138, "PT", "Portugal" },
                    { 139, "GB", "Reino Unido" },
                    { 140, "CF", "República Centroafricana" },
                    { 141, "CZ", "República Checa" },
                    { 142, "DO", "República Dominicana" },
                    { 143, "RW", "Ruanda" },
                    { 144, "RO", "Rumanía" },
                    { 145, "RU", "Rusia" },
                    { 146, "WS", "Samoa" },
                    { 147, "KN", "San Cristóbal y Nieves" },
                    { 148, "SM", "San Marino" },
                    { 149, "VC", "San Vicente y las Granadinas" },
                    { 150, "LC", "Santa Lucía" },
                    { 151, "ST", "Santo Tomé y Príncipe" },
                    { 152, "SN", "Senegal" },
                    { 153, "RS", "Serbia" },
                    { 154, "SC", "Seychelles" },
                    { 155, "SL", "Sierra Leona" },
                    { 156, "SG", "Singapur" },
                    { 157, "SY", "Siria" },
                    { 158, "SO", "Somalia" },
                    { 159, "LK", "Sri Lanka" },
                    { 160, "ZA", "Sudáfrica" },
                    { 161, "SD", "Sudán" },
                    { 162, "SS", "Sudán del Sur" },
                    { 163, "SE", "Suecia" },
                    { 164, "CH", "Suiza" },
                    { 165, "SR", "Surinam" },
                    { 166, "TH", "Tailandia" },
                    { 167, "TZ", "Tanzania" },
                    { 168, "TJ", "Tayikistán" },
                    { 169, "TL", "Timor Oriental" },
                    { 170, "TG", "Togo" },
                    { 171, "TO", "Tonga" },
                    { 172, "TT", "Trinidad y Tobago" },
                    { 173, "TN", "Túnez" },
                    { 174, "TM", "Turkmenistán" },
                    { 175, "TR", "Turquía" },
                    { 176, "TV", "Tuvalu" },
                    { 177, "UA", "Ucrania" },
                    { 178, "UG", "Uganda" },
                    { 179, "UY", "Uruguay" },
                    { 180, "UZ", "Uzbekistán" },
                    { 181, "VU", "Vanuatu" },
                    { 182, "VA", "Vaticano" },
                    { 183, "VE", "Venezuela" },
                    { 184, "VN", "Vietnam" },
                    { 185, "YE", "Yemen" },
                    { 186, "DJ", "Yibuti" },
                    { 187, "ZM", "Zambia" },
                    { 188, "ZW", "Zimbabue" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "DemarcationMaster",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Portero" },
                    { 2, "Lateral Izquierdo" },
                    { 3, "Lateral Derecho" },
                    { 4, "Defensa Central" },
                    { 5, "Líbero" },
                    { 6, "Medio Centro" },
                    { 7, "Medio Centro Defensivo" },
                    { 8, "Mediocampista ofensivo" },
                    { 9, "Mediocampista Izquierdo" },
                    { 10, "Mediocampista Derecho" },
                    { 11, "Delantero Centro" },
                    { 12, "Segundo Delantero" },
                    { 13, "Extremo Izquierdo" },
                    { 14, "Extremo Derecho" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "Materials",
                columns: new[] { "Id", "Name", "TaskTrainingBaseId" },
                values: new object[,]
                {
                    { 1, "Conos", null },
                    { 2, "Balones", null },
                    { 3, "Chalecos", null },
                    { 4, "Picas", null },
                    { 5, "Escaleras de agilidad", null },
                    { 6, "Vallas", null },
                    { 7, "Setas", null },
                    { 8, "Ninguno", null }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "PlayTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Fútbol 11" },
                    { 2, "Fútbol 7" },
                    { 3, "Fútbol Sala" },
                    { 4, "Fútbol-5" },
                    { 5, "Fútbol-Playa" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "PointsTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Físico" },
                    { 2, "Técnico" },
                    { 3, "Táctico" },
                    { 4, "Psicológico" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "SportEventTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Match" },
                    { 2, "Training" },
                    { 3, "Meeting" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "TacticalGoals",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Marcaje" },
                    { 2, "Repliegue" },
                    { 3, "Cobertura" },
                    { 4, "Permuta" },
                    { 5, "Vigilancia defensiva" },
                    { 6, "Temporizaciones" },
                    { 7, "Entrada" },
                    { 8, "Carga" },
                    { 9, "Anticipación" },
                    { 10, "Intercepción" },
                    { 11, "Pressing" },
                    { 12, "Pressing tras pérdida" },
                    { 13, "Desmarques" },
                    { 14, "Apoyos" },
                    { 15, "Ataque" },
                    { 16, "Contraataque" },
                    { 17, "Ritmo de juego" },
                    { 18, "Cambios de ritmo" },
                    { 19, "Conservación de balón" },
                    { 20, "Cambios de orientación" },
                    { 21, "Progresión" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "TechnicalGoals",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Control" },
                    { 2, "Pase" },
                    { 3, "Regate" },
                    { 4, "Tiro" },
                    { 5, "Cabeza" },
                    { 6, "Robo" },
                    { 7, "Conducción" },
                    { 8, "Entrada" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "TechnicalTypes",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Delegado" },
                    { 2, "Delegado de campo" },
                    { 3, "Auxiliar" },
                    { 4, "Entrenador" },
                    { 5, "Segundo Entrenador" },
                    { 6, "Entrenador de porteros" },
                    { 7, "Preparador físico" },
                    { 8, "Médico" },
                    { 9, "Psicólogo" },
                    { 10, "Analista táctico" },
                    { 11, "Nutricionista" }
                });

            migrationBuilder.InsertData(
                schema: "app",
                table: "Categories",
                columns: new[] { "Id", "CategoryGroupId", "Name" },
                values: new object[,]
                {
                    { 1, 1, "COPA RFEF FASE AUTONÓMICA" },
                    { 2, 1, "FINAL COPA RFEF FASE AUTONÓMICA" },
                    { 3, 1, "PLAY OFF TERCERA FEDERACION" },
                    { 4, 1, "TERCERA FEDERACION RFEF" },
                    { 5, 2, "COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS" },
                    { 6, 2, "FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25" },
                    { 7, 2, "FINAL COPA PRIMERA DIVISION AUTONOMICA AFICIONADO RFFM" },
                    { 8, 2, "PRIMERA DIVISION AUTONOMICA AFICIONADO" },
                    { 9, 2, "PREFERENTE AFICIONADO" },
                    { 10, 2, "PRIMERA AFICIONADO" },
                    { 11, 2, "COPA DE AFICIONADOS RFFM TEMP 24/25" },
                    { 12, 2, "SEGUNDA AFICIONADO" },
                    { 13, 3, "NACIONAL JUVENIL" },
                    { 14, 3, "FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 15, 3, "PRIMERA DIVISION AUTONOMICA JUVENIL" },
                    { 16, 3, "PREFERENTE JUVENIL" },
                    { 17, 3, "PRIMERA JUVENIL" },
                    { 18, 3, "SEGUNDA JUVENIL" },
                    { 19, 4, "SUPERLIGA CADETE" },
                    { 20, 4, "DIVISION DE HONOR CADETE" },
                    { 21, 4, "PRIMERA DIVISION AUTONOMICA CADETE" },
                    { 22, 4, "PREFERENTE CADETE" },
                    { 23, 4, "PRIMERA CADETE" },
                    { 24, 4, "SEGUNDA CADETE" },
                    { 25, 5, "SUPERLIGA INFANTIL" },
                    { 26, 5, "DIVISION DE HONOR INFANTIL" },
                    { 27, 5, "PRIMERA DIVISION AUTONOMICA INFANTIL" },
                    { 28, 5, "PREFERENTE INFANTIL" },
                    { 29, 5, "PRIMERA INFANTIL" },
                    { 30, 5, "SEGUNDA INFANTIL" },
                    { 31, 6, "SUPERLIGA ALEVIN" },
                    { 32, 6, "DIVISION DE HONOR ALEVIN" },
                    { 33, 6, "PRIMERA DIVISION AUTONOMICA ALEVIN" },
                    { 34, 6, "PREFERENTE ALEVIN" },
                    { 35, 6, "PRIMERA ALEVIN" },
                    { 36, 7, "VETERANOS MASCULINO F11" },
                    { 37, 7, "PRIMERA DIVISION AUTONÓMICA FEMENINO" },
                    { 38, 7, "PREFERENTE FUTBOL FEMENINO" },
                    { 39, 7, "PRIMERA FUTBOL FEMENINO" },
                    { 40, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL" },
                    { 41, 7, "PREFERENTE FEMENINO JUVENIL" },
                    { 42, 7, "PRIMERA FEMENINO JUVENIL" },
                    { 43, 7, "PRIMERA DIVISION AUTONOMICA FEMENINO CADETE" },
                    { 44, 7, "PREFERENTE FEMENINO CADETE" },
                    { 45, 7, "PRIMERA FEMENINO CADETE" },
                    { 46, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14" },
                    { 47, 8, "CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16" },
                    { 48, 8, "CAMPEONATO UNIVERSITARIO FEMENINO" },
                    { 49, 8, "CAMPEONATO UNIVERSITARIO MASCULINO" },
                    { 50, 8, "CAMPEONATO UNIVERSITARIO MASCULINO 2ª FASE F11" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_CategoryGroupId",
                schema: "app",
                table: "Categories",
                column: "CategoryGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_Clubs_CountryId",
                schema: "app",
                table: "Clubs",
                column: "CountryId");

            migrationBuilder.CreateIndex(
                name: "IX_ConvocationHistories_ConvocationId",
                schema: "app",
                table: "ConvocationHistories",
                column: "ConvocationId");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_AssistanceTypeId",
                schema: "app",
                table: "Convocations",
                column: "AssistanceTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_ConvocationStatusId",
                schema: "app",
                table: "Convocations",
                column: "ConvocationStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_SportEventId",
                schema: "app",
                table: "Convocations",
                column: "SportEventId");

            migrationBuilder.CreateIndex(
                name: "IX_Convocations_TeamPlayerId",
                schema: "app",
                table: "Convocations",
                column: "TeamPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_Materials_TaskTrainingBaseId",
                schema: "app",
                table: "Materials",
                column: "TaskTrainingBaseId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionTrainings_SportEventId",
                schema: "app",
                table: "SessionTrainings",
                column: "SportEventId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionTrainings_TeamId",
                schema: "app",
                table: "SessionTrainings",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_SportEvents_EventTypeId",
                schema: "app",
                table: "SportEvents",
                column: "EventTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_SportEvents_TeamId",
                schema: "app",
                table: "SportEvents",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_SportEvents_TeamId1",
                schema: "app",
                table: "SportEvents",
                column: "TeamId1");

            migrationBuilder.CreateIndex(
                name: "IX_TaskTrainings_SessionTrainingId",
                schema: "app",
                table: "TaskTrainings",
                column: "SessionTrainingId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayers_PlayerId",
                schema: "app",
                table: "TeamPlayers",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamPlayers_TeamId",
                schema: "app",
                table: "TeamPlayers",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_CategoryId",
                schema: "app",
                table: "Teams",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_ClubId",
                schema: "app",
                table: "Teams",
                column: "ClubId");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_SeasonId",
                schema: "app",
                table: "Teams",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_Technicals_TechnicalTypeId",
                schema: "app",
                table: "Technicals",
                column: "TechnicalTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingPointsReports_PlayerId",
                schema: "app",
                table: "TrainingPointsReports",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_TrainingPointsReports_SeasonId",
                schema: "app",
                table: "TrainingPointsReports",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserClubs_ClubId",
                schema: "app",
                table: "UserClubs",
                column: "ClubId");

            migrationBuilder.CreateIndex(
                name: "IX_UserClubs_RoleId",
                schema: "app",
                table: "UserClubs",
                column: "RoleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConvocationHistories",
                schema: "app");

            migrationBuilder.DropTable(
                name: "DemarcationMaster",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Materials",
                schema: "app");

            migrationBuilder.DropTable(
                name: "PlayTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "PointsTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TacticalGoals",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TaskTrainings",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TechnicalGoals",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Technicals",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TrainingPointsReports",
                schema: "app");

            migrationBuilder.DropTable(
                name: "UserClubs",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Convocations",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SessionTrainings",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TaskTrainingBases",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TechnicalTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Memberships",
                schema: "app");

            migrationBuilder.DropTable(
                name: "AssistanceTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "ConvocationStatuses",
                schema: "app");

            migrationBuilder.DropTable(
                name: "TeamPlayers",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SportEvents",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Players",
                schema: "app");

            migrationBuilder.DropTable(
                name: "SportEventTypes",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Teams",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Categories",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Clubs",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Seasons",
                schema: "app");

            migrationBuilder.DropTable(
                name: "CategoryGroups",
                schema: "app");

            migrationBuilder.DropTable(
                name: "Countries",
                schema: "app");
        }
    }
}
