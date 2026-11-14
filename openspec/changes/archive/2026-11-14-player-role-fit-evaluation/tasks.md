## Planning Status

Plan basado en `proposal.md`, los specs de `player-behavior-traits-rating`, `position-fit-ranking`, `deconvocation-tiered-selection` y `squad-rating-sheets`, y `design.md`. Ninguna tarea está hecha. Cada paso sigue TDD (test primero) y ejecuta solo los tests del área afectada; la suite completa y los builds se lanzan una vez al terminar el último paso.

## Step 1: Catálogo de rasgos, puestos y cálculo de encaje (dominio puro)

Cubre: Behavior trait catalog, Trait scale, Unified positions, Candidates by possible positions, Trait weights per position, Fit score.
- [x] 1.1 Tests de dominio backend: mapa de las 14 demarcaciones a los 8 puestos, candidatos multi-puesto, jugador sin demarcación, portero excluido.
- [x] 1.2 Tests del cálculo de encaje: clave frente a suma, indiferente ignorado, rasgos sin nivel, sin datos al final, redondeo a un decimal.
- [x] 1.3 Implementar catálogo de 12 rasgos, pesos por defecto por puesto, mapa de puestos y función de encaje en backend.
- [x] 1.4 Replicar catálogo, pesos por defecto y función de encaje en Front (`ratingTraits.ts`) con los mismos tests, para orden propuesto en cliente.

## Step 2: Persistencia y endpoints de valoración por rasgos

Cubre: Weekly trait rating with carry-over, Weekly trend, Trait rating endpoints and authorization.
- [x] 2.1 Tests funcionales de `POST /api/catalog/team/{teamId}/trait-ratings`: lote correcto, jugador de otro equipo (`RatingPlayerNotInTeam`), rasgo desconocido, nivel fuera de rango, duplicados, más de 100, 403 coach ajeno y 403 jugador/familia, historial conservado.
- [x] 2.2 Tests funcionales de `GET .../trait-ratings/latest` incluida la restricción a Coach y Administrador.
- [x] 2.3 Entidad `TeamPlayerTraitRating` con detalles y tendencia, configuración EF y validador FluentValidation; slices `CreateTeamTraitRatings` y `GetTeamLatestTraitRatings`.
- [x] 2.4 Migración EF aditiva en commit separado.

## Step 3: Pesos por equipo y orden por puesto (backend)

Cubre: Trait weights per position (override por equipo), Proposed order and manual correction, Latest confirmed order exposed.
- [x] 3.1 Tests funcionales de `GET .../position-fit`: orden propuesto sin confirmación, desempate por tendencia y alfabético, bandera de orden manual, 403 para jugador/familia.
- [x] 3.2 Tests funcionales de `PUT .../position-fit/{position}`: orden guardado por semana, jugador no candidato (400), coach ajeno (403), atomicidad.
- [x] 3.3 Entidades `TeamPositionFitOrder` y pesos por equipo, slices `GetTeamPositionFit` y `SavePositionFitOrder`, validadores y migración en commit separado.

## Step 4: Servicios y valoración por rasgos en Front

Cubre: Trait rating UI, Access to trait rating and position order (parte de rasgos), Weekly trait rating with carry-over, Weekly trend.
- [x] 4.1 Tests de `traitRatingService` y del hook `useTraitRating` (arrastre de la semana anterior, solo cambios, tendencia, guardado, errores).
- [x] 4.2 Tests de `TraitRatingPage` (tarjetas por jugador, selector 1–5, nivel anterior marcado, solo lectura, confirmación al salir, sin portero).
- [x] 4.3 Implementar servicio, hook, página y CSS Modules responsive desde 360 px, sin tablas.
- [x] 4.4 Añadir en `RatingSheetPage` el selector de vistas («Capacidad», «Conducta en partido», «Orden por puesto») conservando `teamId` y `seasonId` y confirmando cambios sin guardar; las hojas actuales no cambian.

## Step 5: Orden por puesto en Front

Cubre: Proposed order and manual correction, Unified positions, Access to trait rating and position order.
- [x] 5.1 Tests de `PositionFitPage`: orden propuesto por encaje, desempate por tendencia, reordenar con botones, arrastre, guardado del orden, solo lectura, candidato en dos puestos.
- [x] 5.2 Implementar servicio `positionFitService`, hook, página y componentes de tarjeta con CSS Modules.
- [x] 5.3 Pantalla de pesos por puesto (clave/suma/indiferente) con valores por defecto y sobrescritura por equipo, o dejarla fuera si el entrenador decide mantener solo los valores por defecto en la v1 (ver Open Questions de `design.md`).

## Step 6: Encaje en la propuesta de desconvocatoria

Cubre: Decision funnel order, Fit shown on the proposal card.
- [x] 6.1 Tests de `deconvokeProposal`: peor encaje desconvocado primero, protegido nunca propuesto aunque tenga peor encaje, mínimos por posición prevalecen, puesto sin orden usa equidad, equidad desempata un mismo lugar.
- [x] 6.2 Cargar el orden por puesto en `useConvocationProposal` e integrarlo en el paso 3 del embudo.
- [x] 6.3 Mostrar en la tarjeta «Encaje: Nº de M en <puesto> (x,x)» y tests de la tarjeta.

## Step 7: Cierre

- [x] 7.1 Subir versión minor en `Front/package.json` y `Back/ExtractionApi/Directory.Build.props` en sus commits `feat`.
- [ ] 7.2 Ejecutar una sola vez la suite completa de Front y Back y `npm run build` / `dotnet build`.
- [x] 7.3 Comprobación visual en móvil (360 px) y escritorio de las tres vistas.
- [x] 7.4 `openspec validate player-role-fit-evaluation --strict` y archivado al hacer commit y push.

## Step 8: Tablero por rasgo en «Conducta en partido»

Cubre: Trait board view.
- [x] 8.1 Tests de `TraitBoardView`: rasgos agrupados por fase con progreso, niveles 1–5 y «Sin colocar», colocar varios jugadores, quitar nivel, solo lectura.
- [x] 8.2 Implementar `TraitBoardView` reutilizando `RatingSheetBoard` (props más genéricas) y CSS Modules responsive.
- [x] 8.3 Selector «Por rasgo / Por jugador» en `TraitRatingPage` (por defecto por rasgo) con tests y borrador compartido.

