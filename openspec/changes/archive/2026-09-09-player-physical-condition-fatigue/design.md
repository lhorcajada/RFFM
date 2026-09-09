# Design: Forma física + Cansancio del jugador

## Contexto (estado actual verificado en código)

- `TeamPlayer` (`Domain/Entities/TeamPlayers/TeamPlayer.cs`) tiene `JoinedDate` — se usa como
  fecha de partida para el checkpoint de un jugador sin historial de condición aún.
- `TeamPlayerInjury`/`TeamPlayerSanction` ya siguen el patrón "entidad hija de `TeamPlayer` +
  `EntityTypeConfiguration` en `Infrastructure/Persistence/Configuration/Entities/`" — se sigue
  el mismo patrón para la nueva entidad.
- `Convocation` (`Domain/Aggregates/Assistances/Convocation.cs`) sigue siendo la fuente de
  verdad de asistencia a entrenamiento (`AssistanceTypeId`, `ExcuseTypeId`,
  `ConvocationStatusId` — ver enums en `Domain/Aggregates/Assistances/`).
- `MatchParticipation` (`Domain/Entities/TeamPlayers/MatchParticipation.cs`) sigue siendo la
  fuente de minutos de partido (`MinutesPlayed`, `MatchPhase == "finished"`).
- `PlayerReadinessCalculator` (Rodaje) es un servicio **puro** sin estado — este cambio, en
  cambio, necesita estado persistido porque el usuario confirmó explícitamente ese modelo
  ("valor guardado que se actualiza tras cada evento") en vez de recalcular desde cero cada vez.
- Migraciones EF se generan con `.\manage-migrations.ps1` desde
  `Back/ExtractionApi`, proyecto de arranque `RFFM.Host`.

## Decisión 1 — Nueva entidad `TeamPlayerCondition`

`Domain/Entities/TeamPlayers/TeamPlayerCondition.cs`:

```csharp
public class TeamPlayerCondition : BaseEntity
{
    public string TeamPlayerId { get; private set; } = null!;
    public double PhysicalFitness { get; private set; }
    public double Fatigue { get; private set; }
    public DateTime LastCalculatedDate { get; private set; }

    public TeamPlayer TeamPlayer { get; private set; } = null!;

    private TeamPlayerCondition() { }

    public static TeamPlayerCondition CreateInitial(string teamPlayerId, DateTime asOfDate) =>
        new()
        {
            TeamPlayerId = teamPlayerId,
            PhysicalFitness = PlayerConditionDayEffect.InitialFitness,   // 30
            Fatigue = PlayerConditionDayEffect.InitialFatigue,           // 20
            LastCalculatedDate = asOfDate,
        };

    public void Advance(double fitnessDelta, double fatigueDelta, DateTime newDate)
    {
        PhysicalFitness = Math.Clamp(PhysicalFitness + fitnessDelta, 0, 100);
        Fatigue = Math.Clamp(Fatigue + fatigueDelta, 0, 100);
        LastCalculatedDate = newDate;
    }
}
```

`Infrastructure/Persistence/Configuration/Entities/TeamPlayerConditionEntityConfiguration.cs`
(mismo patrón que `TeamPlayerInjuryEntityConfiguration`): `ToTable("TeamPlayerConditions")`,
`HasIndex(c => c.TeamPlayerId).IsUnique()` (una fila por jugador), `HasOne(c => c.TeamPlayer)`
sin colección inversa nueva en `TeamPlayer` (no hace falta navegación `ICollection`, es 1-a-1;
se consulta directamente por `TeamPlayerId` como con `TeamPlayerSanction`).

Migración: `AddTeamPlayerCondition` vía `.\manage-migrations.ps1` (schema `app`,
`AppDbContext`). `AppDbContext` gana `DbSet<TeamPlayerCondition> TeamPlayerConditions`.

## Decisión 2 — `PlayerConditionDayEffect` (puro, testable sin DB)

`Features/Coaches/Players/Services/PlayerConditionDayEffect.cs`:

```csharp
public static class PlayerConditionDayEffect
{
    public const double InitialFitness = 30;
    public const double InitialFatigue = 20;

    public const double TrainingFitnessDelta = 3;
    public const double TrainingFatigueDelta = 5;

    public const double ReferenceMatchMinutes = 70; // mismo valor de referencia que Rodaje
    public const double FullMatchFitnessDelta = 2;
    public const double FullMatchFatigueDelta = 10;

    public const double RestFitnessDelta = -2;
    public const double RestFatigueDelta = -6;

    public const double InjuryRestFitnessDelta = -4;
    public const double InjuryRestFatigueDelta = -6; // igual que descanso normal

    public enum DayOutcome { Rest, InjuryAbsence, Training, Match }

    public readonly record struct DayEvent(DayOutcome Outcome, int MatchMinutesPlayed = 0);

    public static (double FitnessDelta, double FatigueDelta) Calculate(DayEvent day) => day.Outcome switch
    {
        DayOutcome.Training => (TrainingFitnessDelta, TrainingFatigueDelta),
        DayOutcome.Match => MatchDelta(day.MatchMinutesPlayed),
        DayOutcome.InjuryAbsence => (InjuryRestFitnessDelta, InjuryRestFatigueDelta),
        _ => (RestFitnessDelta, RestFatigueDelta),
    };

    private static (double, double) MatchDelta(int minutesPlayed)
    {
        var factor = Math.Min(1.0, Math.Max(0.0, minutesPlayed) / ReferenceMatchMinutes);
        return (FullMatchFitnessDelta * factor, FullMatchFatigueDelta * factor);
    }
}
```

- Un día con entrenamiento Y partido a la vez (infrecuente pero posible: doble sesión) se
  resuelve tomando **Match** como prioritario en `PlayerConditionRecalculationService` (el
  partido exige más esfuerzo, y evita sumar ambos efectos el mismo día — un día = un `DayEvent`).
- `InjuryAbsence`: convocatoria de entrenamiento ese día con `ExcuseTypeId == Injury` (Id 1),
  igual señal que ya usa `PlayerReadinessCalculator`/Rodaje para lesión — consistencia entre
  ambos indicadores sobre qué cuenta como "lesión".

## Decisión 3 — `PlayerConditionRecalculationService` (con acceso a datos)

`Features/Coaches/Players/Services/PlayerConditionRecalculationService.cs`:

```csharp
public class PlayerConditionRecalculationService(AppDbContext db)
{
    public async Task<TeamPlayerCondition> RecalculateAsync(
        string teamPlayerId, DateTime asOfDateUtc, CancellationToken ct)
    {
        var asOfDate = asOfDateUtc.Date;
        var condition = await db.TeamPlayerConditions
            .FirstOrDefaultAsync(c => c.TeamPlayerId == teamPlayerId, ct);

        if (condition is null)
        {
            var joinedDate = await db.TeamPlayers
                .Where(tp => tp.Id == teamPlayerId)
                .Select(tp => tp.JoinedDate)
                .FirstAsync(ct);
            condition = TeamPlayerCondition.CreateInitial(teamPlayerId, joinedDate.Date);
            db.TeamPlayerConditions.Add(condition);
        }

        if (condition.LastCalculatedDate.Date >= asOfDate) return condition; // ya al día

        var dayEvents = await LoadDayEventsAsync(teamPlayerId, condition.LastCalculatedDate.Date.AddDays(1), asOfDate, ct);

        for (var day = condition.LastCalculatedDate.Date.AddDays(1); day <= asOfDate; day = day.AddDays(1))
        {
            dayEvents.TryGetValue(day, out var dayEvent); // default = Rest si no hay entrada
            var (fitnessDelta, fatigueDelta) = PlayerConditionDayEffect.Calculate(dayEvent);
            condition.Advance(fitnessDelta, fatigueDelta, day);
        }

        return condition;
    }

    private async Task<Dictionary<DateTime, PlayerConditionDayEffect.DayEvent>> LoadDayEventsAsync(
        string teamPlayerId, DateTime fromDateInclusive, DateTime toDateInclusive, CancellationToken ct)
    {
        // Partidos: MatchParticipation "finished" del jugador, agrupados por fecha del SportEvent.
        // Entrenamientos: Convocation con resultado de asistencia real (igual PointsFor "asiste"
        //   de PlayerReadinessCalculator) → Training; con ExcuseTypeId == Injury → InjuryAbsence;
        //   cualquier otro resultado con fecha en rango → no genera entrada (día = Rest por defecto).
        // Un día con Match tiene prioridad sobre Training si ambos existen ese día.
        // (Implementación exacta: dos queries a SportEvents+MatchParticipations y
        // SportEvents+Convocations filtrando por TeamPlayerId y rango de fechas, igual patrón
        // de proyección plana que ya usa GetTeamPlayerStatistics.)
    }
}
```

- `RecalculateAsync` se llama de forma perezosa desde `GetTeamPlayerStatistics` para cada
  jugador de la plantilla, con `asOfDateUtc = DateTime.UtcNow`. Como solo recorre los días
  **desde el último checkpoint**, el coste es proporcional a "días sin consultar", no a toda la
  temporada — barato en el caso normal (se consulta a diario).
- **No hace falta enganchar hooks** en `UpdateConvocationAssistance.cs` ni
  `SaveMatchParticipation.cs`: el recálculo re-escanea los eventos reales ya guardados la
  próxima vez que alguien abre la pestaña de Estadísticas o de Convocatoria, así que un cambio
  retroactivo (editar una convocatoria de hace 3 días) también se refleja correctamente sin
  lógica adicional.
- Confirmado en `Common/Behaviors/CachingBehavior.cs`: el caching de `EasyCaching` es **opt-in**
  vía la interfaz `ICacheRequest` (`CacheKey` + expiración), no automático para todo
  `IQueryApp`. `GetTeamPlayerStatistics.Query` no implementa `ICacheRequest` hoy y no debe
  empezar a hacerlo — sin ese opt-in, el pipeline de caché no entra en juego y no hay riesgo de
  servir una condición física obsoleta desde caché.
- El `SaveChangesAsync()` de la fila `TeamPlayerCondition` (nueva o actualizada) lo dispara el
  `SaveDatabaseChangesPipelineBehavior` ya existente, igual que cualquier otro comando —
  `GetTeamPlayerStatistics` sigue siendo `IQueryApp` en su forma, pero como
  `PlayerConditionRecalculationService` hace un `Add`/mutación de `TeamPlayerCondition`, deja de
  ser "solo lectura" en sentido estricto. Se documenta como excepción consciente y deliberada a
  la regla general de vertical-slice CQRS, justificada porque el propio dato leído (condición
  física al día de hoy) requiere ponerse al día antes de poder leerse — no hay una operación de
  escritura separada y con sentido propio que el usuario dispare explícitamente.

## Decisión 4 — `GetTeamPlayerStatistics` gana 3 campos

```csharp
public record PlayerStatisticsDto(
    // ...campos existentes de Rodaje/temporada...
    double PhysicalFitness,
    double Fatigue,
    double Availability,   // = Math.Max(0, PhysicalFitness - Fatigue)
    int? Readiness,
    ReadinessBreakdownDto? ReadinessBreakdown);
```

El handler llama `await conditionService.RecalculateAsync(player.Id, DateTime.UtcNow, ct)` por
jugador (mismo bucle `foreach` que ya recorre `teamPlayers`), y mapea
`PhysicalFitness`/`Fatigue` al DTO, calculando `Availability` en el propio mapeo.

## Decisión 5 — Frontend

Mismos sitios que Rodaje (confirmado por el usuario):

- `teamPlayerStatisticsService.ts`: `PlayerStatistics` gana `physicalFitness`, `fatigue`,
  `availability` (todos `number`, no `null` — siempre hay un valor tras `RecalculateAsync`,
  a diferencia de `readiness` que sí puede ser `null`).
- `SquadStatistics.tsx`: nuevas filas en la tarjeta ("Forma física", "Cansancio",
  "Disponibilidad"), mismo patrón de barra/color que ya usa Rodaje pero como estadísticas
  independientes (no sustituyen nada existente).
- `ReadinessBadge`/`ReadinessLegend` NO se reutilizan tal cual (son específicos de Rodaje) —
  se crean equivalentes `PhysicalConditionBadge`/`PhysicalConditionLegend` (o se generaliza
  `ReadinessBadge` a un componente `MetricBadge` parametrizable por tramos de color y etiqueta,
  si al implementar resulta trivial hacerlo sin romper los usos existentes de Rodaje —
  decisión de implementación, no bloqueante).
- Convocation tabs (Alineación/Simulador/Partido en directo/Convocatoria): mismo patrón de
  badge en banquillo + punto de color en jugadores de campo + leyenda visible, replicando
  exactamente la mecánica ya construida para Rodaje en esta misma sesión.
- **No** se aplica recálculo "en vivo" (como sí tiene Rodaje) a Forma física/Cansancio en esta
  iteración — los minutos de un partido en curso aún no guardado no deberían adelantar cansancio
  antes de que el partido se guarde, ya que el cansancio real depende del cuerpo del jugador
  tras el esfuerzo, no de una proyección optimista a mitad de partido. Non-goal explícito.

## Addendum 3 — rediseño visual: "Ef" (Rodaje − Cansancio), barras tipo FIFA, leyendas únicas

Feedback del usuario tras ver la primera versión en pantalla:

1. **"Disponibilidad" no se entiende sin explicación** y su fórmula (Forma física − Cansancio)
   no es la que el usuario quiere transmitir. Se **redefine y renombra**: `Ef` ("Estado de
   forma", el término futbolístico habitual) `= Rodaje − Cansancio` (clamped a ≥0; `null` si
   `Rodaje` es `null`, ya que sin Rodaje no hay dato del que partir). **No se calcula en
   backend** — se deriva en el frontend a partir de `readiness` y `fatigue`, que ya viajan en
   la respuesta (`Math.max(0, Math.min(100, readiness - fatigue))`). Los campos de backend
   `PhysicalFitness`/`Availability` **dejan de mostrarse en la UI** (se quedan calculados en el
   backend, sin consumidor visual por ahora — no se borran por si una futura iteración los
   retoma, pero no forman parte de esta pantalla).
2. **Solo 3 indicadores visibles de ahora en adelante**: `Ef` (padre, derivado), `R` (Rodaje),
   `C` (Cansancio) — "Forma física" deja de tener hueco propio en la UI.
3. **Puntos de color en jugadores de campo → barras tipo FIFA con etiqueta de letra siempre
   visible** (no tooltip): el punto de color dependía de `title`/hover, que no funciona en
   tablet (sin cursor). Se sustituye por un indicador compacto de 3 barritas verticales
   apiladas/lado a lado sobre cada jugador de campo, cada una con su letra (`Ef`/`R`/`C`)
   siempre visible junto a la barra, coloreada por tramo (mismo criterio de color ya usado).
4. **Tarjetas de banquillo**: mostrar el % de los tres, con jerarquía visual padre-hijo — `Ef`
   más grande/destacado arriba, `R` y `C` más pequeños/indentados debajo, como si fueran hijos
   de `Ef`.
5. **Ficha de jugador en pestaña Convocatoria** (`ConvocationTab.tsx`, vía `PlayerCromo.tsx`):
   barras horizontales con una etiqueta de texto delante de cada una (`"Ef"`, `"Rodaje"`,
   `"Cansancio"`), no solo la letra — hay más espacio que en un slot de campo.
6. **Leyendas: una sola, no repartidas**: hasta ahora había una leyenda de Rodaje y otra de
   "jornadas sin decisión técnica" en sitios distintos de cada pestaña — se consolidan en **una
   única leyenda por pantalla**, con las 3 entradas (`Ef`, `R`, `C`) más la de streak, en un
   solo sitio visible (no una leyenda en el banquillo y otra distinta en el campo).
7. **Alineación, Simulador y Partido en directo**: mismo tratamiento (barras en campo,
   porcentajes padre-hijo en banquillo, leyenda única consolidada).
8. **Plantilla** (`Squad.tsx` tab 0, tarjetas `PlayerCromo.tsx`): añadir también esta
   información (Ef/R/C) a las tarjetas, no solo en la pestaña "Estadísticas".
9. **Actualización en vivo**: `Ef`/`R` deben reflejar el transcurso de un partido/simulación en
   curso — ya existe `computeLiveReadiness` para `R`; `Ef` en vivo se deriva como
   `max(0, liveReadiness - fatigue)` (Cansancio no se recalcula en vivo minuto a minuto — su
   actualización sigue siendo por día, vía `PlayerConditionRecalculationService`, que ya se
   dispara en la siguiente lectura tras guardar un entrenamiento/partido; esto se documenta
   como simplificación consciente, no un olvido). Fuera de partido/simulación (Alineación,
   Convocatoria, Plantilla, Estadísticas), `Ef`/`R`/`C` muestran el valor ya calculado por el
   backend sin recomputar nada en vivo.

**Componentes nuevos/reestructurados**: `AvailabilityBadge`/`AvailabilityLegend` quedan
obsoletos para esta pantalla (no se borran de golpe si otro sitio los usa, pero no se referencia
más el concepto "Disponibilidad" en las pantallas de jugador) — se sustituyen por un componente
de barras (`PlayerFormBars` o nombre equivalente) con variantes `compact` (campo, solo letras)
y `full` (banquillo/ficha, etiqueta + barra + %), y una leyenda consolidada única
(`PlayerFormLegend`) con las 3 entradas Ef/R/C (+ streak donde ya existía).

## Addendum 4 — bug: los amistosos no contaban para el Rodaje (solo para el Cansancio)

Bug real detectado en producción de datos de prueba (2026-09-09): un jugador que entrenó los 3
entrenamientos de la ventana **y jugó un amistoso** ("Amistoso en Parla", domingo) mostraba un
`Ef` (Rodaje − Cansancio) **peor** que un jugador con solo 1 entrenamiento.

**Causa**: `GetTeamPlayerStatistics` filtraba el componente de partidos del Rodaje por
`EventTypeId == SportEventType.FromName("Partido").Id`, excluyendo amistosos y torneos —
mientras que `PlayerConditionRecalculationService` (Cansancio) **no** filtraba por tipo de
evento, solo por `MatchPhase == "finished"`. Resultado: jugar el amistoso subía correctamente
el Cansancio (esfuerzo físico real) pero no aportaba nada al Rodaje (crédito perdido),
haciendo que `Ef` penalizara injustamente a quien sí jugó.

**Fix**: se quita el filtro `EventTypeId == Partido` de la consulta de partidos-en-ventana del
Rodaje — ahora cualquier `MatchParticipation` `finished` dentro de la ventana cuenta (Partido,
Amistoso, Torneo), igual que ya hacía el cálculo de Cansancio. Los amistosos/torneos siguen
excluidos donde corresponde por otras razones de negocio (contador cíclico de amarillas/
sanciones automáticas, `GetSeasonPlayerStats`) — este cambio solo afecta al componente físico
de Rodaje, no a esas reglas de disciplina.

Test de regresión:
`GetTeamPlayerStatisticsHandlerTests.PlayerWithFriendlyMatchMinutes_CountsTowardReadinessMatchComponent`.

## Addendum 5 — sin punto de equilibrio: la carga sostenida de referencia hacía subir el
cansancio sin freno hasta el tope

El usuario preguntó: "¿cuándo tendrá un jugador buen Ef si viene a entrenar a todo y juega
todos los partidos ~60 min?". Con `RestFatigueDelta = -2` (Addendum 3), la respuesta era
"nunca a partir de la semana 7-8": la ganancia semanal de Cansancio con la carga de referencia
(2 entrenos + 1 partido de 60 min/semana, el mismo ritmo que `PlayerReadinessCalculator` usa
como "plena forma") es `2×5 + 10×60/70 ≈ 18.57`, muy por encima de lo que recuperan los 4 días
de descanso de esa semana (`4×-2 = -8`) — el Cansancio subía sin freno hasta tocar el tope de
100, arruinando `Ef` justo para el jugador más comprometido posible.

**Fix**: `RestFatigueDelta`/`InjuryRestFatigueDelta` pasan de -2 a **-4.64/día** — calibrado
para que la ganancia semanal de la carga de referencia (`18.57`) se compense exactamente con
la recuperación de los 4 días de descanso de esa semana (`4×-4.64 ≈ -18.57`). Confirmado con el
usuario un objetivo de equilibrio de Cansancio ~40-45 para esa carga sostenida (2026-09-09).

**Limitación conocida**: el modelo sigue siendo de deltas fijos por día (no hay decaimiento
proporcional/exponencial), así que este "equilibrio" es aproximado — no es un atractor real,
solo hace que la carga de referencia no diverja. Un jugador con más carga que la referencia
seguirá subiendo de cansancio (correcto); uno con menos, seguirá bajando hacia 0 (correcto).

**Nota de test**: `-4.64` no es representable exactamente en `double`, así que comparar el
resultado acumulado día a día del servicio contra un cálculo independiente en el test con
`Assert.Equal` sin tolerancia puede fallar por el último bit (orden de operaciones distinto) —
usar `Assert.Equal(expected, actual, precision: 6)` en vez de igualdad exacta para estos casos.

## Non-goals reiterados
- Sin reconstrucción retroactiva del historial completo de temporadas anteriores.
- Sin correlación con riesgo de lesión.
- Sin recálculo en vivo durante partido/simulación (a diferencia de Rodaje).
- Rodaje no se toca; siguen siendo indicadores independientes.

## Decisiones confirmadas con el usuario
- Valores de partida: Forma 30 / Cansancio 20.
- Entrenamiento: Forma +3 / Cansancio +5.
- Partido completo (referencia 70 min, proporcional a minutos reales): Forma +2 / Cansancio +10.
- Descanso normal: Forma -2 / Cansancio -2 por día (bajado de -6 tras verlo en producción: con
  2-3 entrenos/semana el descanso recuperaba más rápido de lo que costaba entrenar y el
  Cansancio caía a 0 siempre entre sesiones — retunado 2026-09-09).
- Ausencia por lesión: Forma -4 / Cansancio -2 por día (misma recuperación que descanso normal).
- Modelo de cálculo: valor persistido, actualizado de forma incremental (elegido por el usuario
  explícitamente sobre la alternativa de recálculo derivado tipo Rodaje).
- Indicador combinado Disponibilidad = Forma − Cansancio (clamped ≥0).
- Ubicación UI: los mismos sitios donde ya se muestra Rodaje.
