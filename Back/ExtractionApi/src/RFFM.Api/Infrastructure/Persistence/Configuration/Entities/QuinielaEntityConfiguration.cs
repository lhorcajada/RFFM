using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RFFM.Api.Domain.Aggregates.UserClubs;
using RFFM.Api.Domain.Entities.Teams;

namespace RFFM.Api.Infrastructure.Persistence.Configuration.Entities
{
    internal class QuinielaJornadaEntityConfiguration : IEntityTypeConfiguration<QuinielaJornada>
    {
        public void Configure(EntityTypeBuilder<QuinielaJornada> builder)
        {
            builder.ToTable("QuinielaJornadas");

            builder.HasKey(j => j.Id);

            builder.Property(j => j.TeamId).IsRequired();
            // La jornada RFFM vive en el esquema federation (otro DbContext): sin clave foránea.
            builder.Property(j => j.RffmRoundId).HasMaxLength(36).IsRequired();
            builder.Property(j => j.Price).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(j => j.PrizePercent).HasColumnType("decimal(5,2)").IsRequired();
            builder.Property(j => j.CarryIn).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(j => j.CarryOut).HasColumnType("decimal(10,2)");
            builder.Property(j => j.Status).IsRequired();

            builder.HasIndex(j => new { j.TeamId, j.RffmRoundId }).IsUnique();

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(j => j.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    internal class QuinielaTeamSettingsEntityConfiguration : IEntityTypeConfiguration<QuinielaTeamSettings>
    {
        public void Configure(EntityTypeBuilder<QuinielaTeamSettings> builder)
        {
            builder.ToTable("QuinielaTeamSettings");

            builder.HasKey(s => s.Id);

            builder.Property(s => s.TeamId).IsRequired();
            builder.Property(s => s.FundPercent).HasColumnType("decimal(5,2)").IsRequired();
            builder.Ignore(s => s.PrizePercent);

            builder.HasIndex(s => s.TeamId).IsUnique();

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(s => s.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    internal class QuinielaWalletEntityConfiguration : IEntityTypeConfiguration<QuinielaWallet>
    {
        public void Configure(EntityTypeBuilder<QuinielaWallet> builder)
        {
            builder.ToTable("QuinielaWallets");

            builder.HasKey(w => w.Id);

            builder.Property(w => w.TeamId).IsRequired();
            // El usuario vive en el esquema identity (otro DbContext): sin clave foránea.
            builder.Property(w => w.ApplicationUserId).HasMaxLength(450).IsRequired();
            builder.Property(w => w.Balance).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(w => w.UpdatedAt).IsRequired();
            // xmin de PostgreSQL como token de concurrencia: dos cobros simultáneos no gastan el mismo saldo.
            builder.Property(w => w.Version).IsRowVersion();

            builder.HasIndex(w => new { w.TeamId, w.ApplicationUserId }).IsUnique();

            builder.HasOne<Team>()
                .WithMany()
                .HasForeignKey(w => w.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    internal class QuinielaWalletMovementEntityConfiguration : IEntityTypeConfiguration<QuinielaWalletMovement>
    {
        public void Configure(EntityTypeBuilder<QuinielaWalletMovement> builder)
        {
            builder.ToTable("QuinielaWalletMovements");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.WalletId).IsRequired();
            builder.Property(m => m.Amount).HasColumnType("decimal(10,2)").IsRequired();
            builder.Property(m => m.Type).IsRequired();
            builder.Property(m => m.OccurredAt).IsRequired();
            builder.Property(m => m.Description).HasMaxLength(QuinielaWallet.Rules.MaxDescriptionLength);
            // El boleto y el usuario creador pueden desaparecer: el historial se conserva, sin clave foránea.
            builder.Property(m => m.TicketId).HasMaxLength(36);
            builder.Property(m => m.CreatedByUserId).HasMaxLength(450);

            builder.HasIndex(m => new { m.WalletId, m.OccurredAt });
            builder.HasIndex(m => m.TicketId, "IX_QuinielaWalletMovements_TicketId");

            builder.HasOne<QuinielaWallet>()
                .WithMany()
                .HasForeignKey(m => m.WalletId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    internal class QuinielaTicketEntityConfiguration: IEntityTypeConfiguration<QuinielaTicket>
    {
        public void Configure(EntityTypeBuilder<QuinielaTicket> builder)
        {
            builder.ToTable("QuinielaTickets");

            builder.HasKey(t => t.Id);

            builder.Property(t => t.JornadaId).IsRequired();
            // El usuario vive en el esquema identity (otro DbContext): sin clave foránea.
            builder.Property(t => t.ApplicationUserId).HasMaxLength(450).IsRequired();
            builder.Property(t => t.PlenoHome).IsRequired();
            builder.Property(t => t.PlenoAway).IsRequired();
            builder.Property(t => t.PaymentStatus).IsRequired();
            builder.Property(t => t.Prize).HasColumnType("decimal(10,2)");

            builder.Property(t => t.Number).IsRequired().HasDefaultValue(1);

            builder.HasIndex(t => new { t.JornadaId, t.ApplicationUserId });

            builder.HasOne<QuinielaJornada>()
                .WithMany()
                .HasForeignKey(t => t.JornadaId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(t => t.Picks).UsePropertyAccessMode(PropertyAccessMode.Field);
        }

        /// <summary>
        /// Los pronósticos son una colección owned. Se declara desde <see cref="AppDbContext"/> antes de
        /// <c>ConfigureSmartEnum()</c>: ese método configura de forma explícita todas las entidades del modelo y,
        /// si encuentra <see cref="QuinielaPick"/> como entidad normal, ya no se puede convertir en owned.
        /// </summary>
        internal static void ConfigurePicks(ModelBuilder modelBuilder) =>
            modelBuilder.Entity<QuinielaTicket>().OwnsMany(t => t.Picks, picks =>
            {
                picks.ToTable("QuinielaPicks");
                picks.WithOwner().HasForeignKey("TicketId");
                picks.Property<int>("Id").ValueGeneratedOnAdd();
                picks.HasKey("Id");
                picks.Property(p => p.RecordCode).HasMaxLength(100).IsRequired();
                picks.Property(p => p.Sign).IsRequired();
            });
    }
}
