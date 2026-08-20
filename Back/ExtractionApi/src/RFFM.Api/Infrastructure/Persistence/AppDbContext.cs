using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.GameModels;
using RFFM.Api.Domain.Aggregates.SeasonPlans;
using RFFM.Api.Domain.Aggregates.Technicals;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Coaches;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.Formations;
using RFFM.Api.Domain.Entities.TeamPlayers;
using RFFM.Api.Domain.Entities.SeasonAccess;
using RFFM.Api.Domain.Entities.News;
using RFFM.Api.Domain.Entities.PushNotifications;
using SmartEnum.EFCore;

namespace RFFM.Api.Infrastructure.Persistence
{
    public class AppDbContext : DbContext
    {
        public DbSet<Club> Clubs { get; set; }
        public DbSet<UserClub> UserClubs { get; set; }
        public DbSet<UserTeam> UserTeams { get; set; }
        public DbSet<ClubJoinRequest> ClubJoinRequests { get; set; }
        public DbSet<Country> Countries { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<League> Leagues { get; set; }

        public DbSet<Season> Seasons { get; set; }
        public DbSet<PlayType> PlayTypes { get; set; }
        public DbSet<Technical> Technicals { get; set; }
        public DbSet<TechnicalType> TechnicalTypes { get; set; }
        public DbSet<Player> Players { get; set; }
        public DbSet<DemarcationMaster> DemarcationMaster { get; set; }
        public DbSet<Membership> Roles { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<TeamPlayer> TeamPlayers { get; set; }
        public DbSet<TeamPlayerRating> TeamPlayerRatings { get; set; }
        public DbSet<TeamPlayerRatingDetail> TeamPlayerRatingDetails { get; set; }
        public DbSet<TeamPlayerInjury> TeamPlayerInjuries { get; set; }
        public DbSet<TeamPlayerSanction> TeamPlayerSanctions { get; set; }
        public DbSet<AssistanceType> AssistanceTypes { get; set; }
        public DbSet<Convocation> Convocations { get; set; }
        public DbSet<ConvocationHistory> ConvocationHistories { get; set; }
        public DbSet<ConvocationStatus> ConvocationStatuses { get; set; }
        public DbSet<SportEvent> SportEvents { get; set; }
        public DbSet<EventRecurrence> EventRecurrences { get; set; }
        public DbSet<SportEventType> SportEventTypes { get; set; }
        public DbSet<EventAttendanceConfirmation> EventAttendanceConfirmations { get; set; }
        public DbSet<TrainingSession> TrainingSessions { get; set; }
        public DbSet<TaskTraining> TasksTraining { get; set; }
        public DbSet<MaterialsEnum> Materials { get; set; }
        public DbSet<PointsTypeEnum> PointsTypes { get; set; }
        public DbSet<TrainingPointsReport> TrainingPointsReports { get; set; }
        public DbSet<TaskTrainingBase> TaskTrainingBases { get; set; }
        public DbSet<ExerciseType> ExerciseTypes { get; set; }
        public DbSet<TaskTrainingType> TaskTrainingTypes { get; set; }
        public DbSet<ExerciseCondition> ExerciseConditions { get; set; }
        public DbSet<ExerciseModelLink> ExerciseModelLinks { get; set; }
        public DbSet<TechnicalGoalsEnum> TechnicalGoals { get; set; }
        public DbSet<Rival> Rivals { get; set; }
        public DbSet<ExcuseTypes> ExcuseTypes { get; set; }
        public DbSet<ConfigurationCoach> ConfigurationCoaches { get; set; }

        // Club kits
        public DbSet<ClubKit> ClubKits { get; set; }

        // Formations catalog
        public DbSet<Formation> Formations { get; set; }

        // Ideal lineup
        public DbSet<TeamIdealLineup> TeamIdealLineups { get; set; }
        public DbSet<TeamIdealLineupSlot> TeamIdealLineupSlots { get; set; }

        // Season access selections
        public DbSet<SeasonAccessTrial> SeasonAccessTrials { get; set; }
        public DbSet<SeasonAccessTrialPlayer> SeasonAccessTrialPlayers { get; set; }
        public DbSet<SeasonAccessTrialDay> SeasonAccessTrialDays { get; set; }

        // Match participation (partido en directo)
        public DbSet<MatchParticipation> MatchParticipations { get; set; }

        // User profile (role + player/team association)
        public DbSet<UserProfile> UserProfiles { get; set; }

        // Payment plans and subscriptions
        public DbSet<PaymentPlan> PaymentPlans { get; set; }
        public DbSet<Subscription> Subscriptions { get; set; }

        // Club seat charges (billing)
        public DbSet<ClubSeatCharge> ClubSeatCharges { get; set; }

        // RBAC — feature and page permissions
        public DbSet<FeaturePermission> FeaturePermissions { get; set; }
        public DbSet<PagePermission> PagePermissions { get; set; }

        // Team rules ("Normas del equipo")
        public DbSet<TeamRulesSet> TeamRulesSets { get; set; }
        public DbSet<TeamRule> TeamRules { get; set; }

        // Game Model
        public DbSet<GameModel> GameModels { get; set; }
        public DbSet<GameMoment> GameMoments { get; set; }
        public DbSet<GameZone> GameZones { get; set; }
        public DbSet<GamePrinciple> GamePrinciples { get; set; }
        public DbSet<Subprincipio> Subprincipios { get; set; }
        public DbSet<Zona> Zonas { get; set; }
        public DbSet<Habilidad> Habilidades { get; set; }
        public DbSet<Nota> Notas { get; set; }
        public DbSet<SetPieceRule> SetPieceRules { get; set; }
        public DbSet<OpenIssue> OpenIssues { get; set; }

        // Season prep session
        public DbSet<SeasonPrepSession> SeasonPrepSessions { get; set; }
        public DbSet<SeasonPrepTeamSession> SeasonPrepTeamSessions { get; set; }
        public DbSet<SeasonPrepAllTeamsSession> SeasonPrepAllTeamsSessions { get; set; }
        public DbSet<SeasonPrepEvaluations> SeasonPrepEvaluations { get; set; }
        public DbSet<SeasonPrepPlayerRating> SeasonPrepPlayerRatings { get; set; }
        public DbSet<SeasonPrepPlayerRatingDetail> SeasonPrepPlayerRatingDetails { get; set; }
        public DbSet<SubSubPrincipio> SubSubPrincipios { get; set; }

        // Season Plan (coach season planning: Macrociclo -> Mesociclo -> Microciclo)
        public DbSet<SeasonPlan> SeasonPlans { get; set; }
        public DbSet<Macrociclo> Macrociclos { get; set; }
        public DbSet<Mesociclo> Mesociclos { get; set; }
        public DbSet<Microciclo> Microciclos { get; set; }
        public DbSet<MicrocicloSubprincipioLink> MicrocicloSubprincipioLinks { get; set; }
        public DbSet<MicrocicloSubSubPrincipioLink> MicrocicloSubSubPrincipioLinks { get; set; }

        // News
        public DbSet<NewsItem> News { get; set; }

        // Push notifications
        public DbSet<PushToken> PushTokens { get; set; }

        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.HasDefaultSchema("app");
            base.OnModelCreating(modelBuilder);

            modelBuilder.ConfigureSmartEnum();

            ApplyAllEntityConfigurations(modelBuilder);
        }

        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return await base.SaveChangesAsync(cancellationToken);
        }


        private void ApplyAllEntityConfigurations(ModelBuilder modelBuilder)
        {
            var dbSetEntityTypes = GetType()
                .GetProperties()
                .Where(p => p.PropertyType.IsGenericType &&
                            p.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>))
                .Select(p => p.PropertyType.GetGenericArguments()[0])
                .ToHashSet();

            var configurationType = typeof(IEntityTypeConfiguration<>);

            var configurations = GetType().Assembly
                .GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract)
                .SelectMany(t => t.GetInterfaces()
                    .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == configurationType)
                    .Select(i => (EntityType: i.GenericTypeArguments[0], ConfigurationInstance: Activator.CreateInstance(t))))
                .Where(x => dbSetEntityTypes.Contains(x.EntityType))
                .ToList();

            foreach (var (entityType, configurationInstance) in configurations)
            {
                var applyConfigMethod = typeof(ModelBuilder)
                    .GetMethods()
                    .First(m => m.Name == "ApplyConfiguration" && m.GetParameters().Length == 1)
                    .MakeGenericMethod(entityType);

                applyConfigMethod.Invoke(modelBuilder, new[] { configurationInstance });
            }
        }
    }
}
