using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RFFM.Api.Domain.Aggregates.Assistances;
using RFFM.Api.Domain.Aggregates.Technicals;
using RFFM.Api.Domain.Aggregates.Training;
using RFFM.Api.Domain.Aggregates.Training.TasksTraining;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities;
using RFFM.Api.Domain.Entities.Competitions;
using RFFM.Api.Domain.Entities.Demarcations;
using RFFM.Api.Domain.Entities.Federation;
using RFFM.Api.Domain.Entities.Players;
using RFFM.Api.Domain.Entities.Seasons;
using RFFM.Api.Domain.Entities.TeamPlayers;
using SmartEnum.EFCore;

namespace RFFM.Api.Infrastructure.Persistence
{
    public class AppDbContext : DbContext
    {
        private readonly DbConnection _connection;
        public DbSet<Club> Clubs { get; set; }
        public DbSet<UserClub> UserClubs { get; set; }
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
        public DbSet<AssistanceType> AssistanceTypes { get; set; }
        public DbSet<Convocation> Convocations { get; set; }
        public DbSet<ConvocationHistory> ConvocationHistories { get; set; }
        public DbSet<ConvocationStatus> ConvocationStatuses { get; set; }
        public DbSet<SportEvent> SportEvents { get; set; }
        public DbSet<SportEventType> SportEventTypes { get; set; }
        public DbSet<TrainingSession> TrainingSessions { get; set; }
        public DbSet<TaskTraining> TasksTraining { get; set; }
        public DbSet<MaterialsEnum> Materials { get; set; }
        public DbSet<PointsTypeEnum> PointsTypes { get; set; }
        public DbSet<TacticalGoalsEnum> TacticalGoals { get; set; }
        public DbSet<TrainingPointsReport> TrainingPointsReports { get; set; }
        public DbSet<TaskTrainingBase> TaskTrainingBases { get; set; }
        public DbSet<TechnicalGoalsEnum> TechnicalGoals { get; set; }
        public DbSet<Rival> Rivals { get; set; }
        public DbSet<ExcuseTypes> ExcuseTypes { get; set; }
        public DbSet<FederationSetting> FederationSettings { get; set; }
        
        public AppDbContext(DbConnection connection)
        {
            _connection = connection;
        }
      
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlServer(_connection, sqlServerOptions =>
            {
                // Habilitar retry automático en caso de fallos transitorios
                sqlServerOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,                    // Máximo 5 reintentos
                    maxRetryDelay: TimeSpan.FromSeconds(30),  // Máximo 30 segundos entre reintentos
                    errorNumbersToAdd: null              // Usar los errores transitorios por defecto
                );
                
                // Configuración adicional para Azure SQL
                sqlServerOptions.CommandTimeout(60);     // Timeout de 60 segundos
            });
            
            // Suprimir warning de pending model changes para permitir migraciones iniciales
            optionsBuilder.ConfigureWarnings(warnings =>
                warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
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
            var configurationType = typeof(IEntityTypeConfiguration<>);

            var configurations = GetType().Assembly
                .GetTypes()
                .Where(t => t.IsClass && !t.IsAbstract)
                .SelectMany(t => t.GetInterfaces()
                    .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == configurationType)
                    .Select(i => (EntityType: i.GenericTypeArguments[0], ConfigurationInstance: Activator.CreateInstance(t))))
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
