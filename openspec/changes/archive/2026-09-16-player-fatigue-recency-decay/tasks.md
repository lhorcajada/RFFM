## 1. Calculador puro con decaimiento (TDD)

- [x] 1.1 Reescribir `tests/RFFM.Api.Tests/UnitTests/PlayerFatigueCalculatorTests.cs` (Red):
      sin eventos → 0; entreno hoy vs. entreno hace 2 días (decae a la mitad); dos entrenos hoy
      → componente completo; partido hoy con minutos de referencia → componente completo;
      partido hace 2 días con minutos de referencia → decae a la mitad; combinación completa hoy
      → 100; caso real "Lucas" (entreno hace 6 días, partido 90' hace 3 días, entreno hace 1 día)
      → Fatigue ≈ 44, no 100; evento en el borde de la ventana de carga (14 días) → contribución
      despreciable; entreno + partido mismo día → contribuyen de forma independiente sin caso
      especial.
- [x] 1.2 Implementar la nueva firma de `Features/Coaches/Players/Services/PlayerFatigueCalculator.cs`
      (Green): `Calculate(IReadOnlyList<int> trainingDaysAgo, IReadOnlyList<(int DaysAgo, int MinutesPlayed)> matches)`,
      `HalfLifeDays = 2.0`, `Decay(daysAgo) = Math.Pow(0.5, daysAgo / HalfLifeDays)`,
      `WindowDays` pasa de 7 a 14 con comentario explicando el cambio de significado (corte de
      carga, no de saturación).
- [x] 1.3 Confirmar `dotnet test --filter PlayerFatigueCalculatorTests` en verde.

## 2. Integración en el handler

- [x] 2.1 En `Features/Coaches/Players/Queries/GetTeamPlayerStatistics.cs`, sustituir los
      diccionarios de conteo/suma plana (`trainingsAttendedInFatigueWindowByPlayer`,
      `matchMinutesInFatigueWindowByPlayer`) por diccionarios de `List<int>` (días transcurridos
      por entreno asistido) y `List<(int DaysAgo, int MinutesPlayed)>` (por participación de
      partido), reutilizando `trainingConvocationsInWindow`/`participationsInWindow` y los
      diccionarios `eventId → fecha` ya existentes, filtrados por la ventana de 14 días
      (`fatigueWindowStart`).
- [x] 2.2 Actualizar la llamada a `PlayerFatigueCalculator.Calculate(...)` en el bucle
      por-jugador con la nueva firma.
- [x] 2.3 Actualizar `tests/RFFM.Api.Tests/UnitTests/GetTeamPlayerStatisticsHandlerTests.cs`:
      reescribir los tests de `Fatigue` que asumían conteo plano dentro de una ventana de 7 días
      todo-o-nada, añadir un test con el caso real de Lucas sembrado con fechas reales
      (`SeedSportEventAsync`/`SeedConvocationAsync`/`SeedMatchParticipationAsync`), y un test
      que confirme que un evento fuera de la ventana de carga de 14 días no cuenta.

## 3. Verificación

- [x] 3.1 `dotnet build` en verde.
- [x] 3.2 `dotnet test` completo en verde (área afectada: `RFFM.Api.Tests`).
- [x] 3.3 No commitear/pushear — dejar los cambios en el working tree para revisión del usuario.
