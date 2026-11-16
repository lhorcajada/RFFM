## Planning Status

Planificación a partir de proposal, specs y design. Implementación en curso: pasos 1 a 4 hechos con tests afectados en verde y build del front correcto; pendiente el paso 5.

## Step 1: Backend — lectura del directo para jugadores y familiares
- [x] 1.1 Tests funcionales: jugador del equipo lee (200), jugador de otro equipo (403), jugador actúa (403), join del hub permitido/rechazado.
- [x] 1.2 Ampliar `GetLiveMatch` y el chequeo compartido de pertenencia al equipo a jugadores/familiares; acciones solo coach.
- [x] 1.3 Verificar que los endpoints de convocatoria y grid responden a un jugador; abrir su lectura si no.
- [x] 1.4 Subir versión de la API (minor).

## Step 2: Front — acceso y pestañas
- [x] 2.1 Tests de `ConvocationMatchDetail` como jugador: solo dos pestañas, sin propuesta.
- [x] 2.2 Quitar `allowPlayerAccess={false}` de `match` y `live` en `routes.tsx`.
- [x] 2.3 Filtrar pestañas y pasar `readOnly` a `ConvocationTab`.

## Step 3: Front — barra de acciones y Convocatoria solo lectura
- [x] 3.1 Tests de `ConvocationMatchActionBar`: solo Volver, y Partido en directo desde la hora de inicio.
- [x] 3.2 Implementar `readOnly` y `showLiveMatch` en la barra.
- [x] 3.3 Tests e implementación de `readOnly` en `ConvocationTab` (sin propuesta, sin arrastre ni mover).

## Step 4: Front — directo en solo lectura
- [x] 4.1 Tests de `LiveMatchViewer` y de `LiveMatchPage` como jugador (visor de solo lectura, sin controles).
- [x] 4.2 Implementar `LiveMatchViewer` y subir versión de Front (minor).

## Step 4b: Front — entrada directa desde el evento
- [x] 4b.1 Tests y redirección de `AttendanceEvent` a la pantalla de partido para jugador y familiar en partidos de liga.

## Step 5: Verificación final
- [ ] 5.1 Suite completa Front, build y `dotnet test` una sola vez al terminar.
- [x] 5.2 Comprobación visual móvil como jugador.
