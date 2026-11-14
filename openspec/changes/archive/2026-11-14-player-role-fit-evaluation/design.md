## Context

Verified facts:
- La hoja actual (`Front/src/apps/coach/pages/squad/rating/`) valora 28 características genéricas con 10 niveles y las promedia en 4 categorías (`PlayerRating`: physical, technical, tactical, competitiveness). La propuesta de desconvocatoria las pondera en `weightedRating` (`deconvokeProposal.ts`).
- El modelo de juego (`GetGameModel.cs`) es Principio → Subprincipio → Zona → Sub-subprincipio (`Rol` texto libre) → Habilidad. No está enlazado a posiciones ni a valoraciones.
- `DemarcationMaster` tiene 14 demarcaciones (POR, LI, LD, DFC, LIB, MC, MCD, MCO, MI, MD, DC, SD, EI, ED). `GET /api/catalog/team/{teamId}/players` ya expone `activePositionId` y `possibleDemarcationIds` (spec `deconvoke-proposal-positions`).
- `GetTeamLatestRatings` y `POST /api/catalog/team/{teamId}/ratings` (spec `squad-rating-sheets`) son el patrón a seguir; el GET actual deja leer valoraciones a jugadores vinculados, algo que no debe ocurrir con las nuevas.
- El embudo de desconvocatoria (`deconvocation-tiered-selection`) decide por protecciones, mínimos por posición, orden de equidad y dificultad del rival.

Assumptions:
- El entrenador valora a todos los jugadores de campo cada semana, con arrastre de la semana anterior.
- Rasgos y pesos por defecto son una primera propuesta del entrenador y se ajustarán con el uso.

## Goals / Non-Goals

Goals:
- Medir «lo hace en partido» con un catálogo común de 12 rasgos, separado de la capacidad actual.
- Obtener un orden de encaje por puesto, corregible a mano, que alimente la desconvocatoria.
- Mantener la valoración semanal rápida: arrastre, solo cambios, escala de 5 niveles.

Non-goals:
- Valoración de porteros con rasgos (queda la hoja actual).
- Derivar rasgos automáticamente del modelo de juego (`Rol` es texto libre).
- Añadir demarcaciones (carrilero, interior, media punta) ni cambiar las existentes.
- Elegir el trío de medio campo como bloque; se decide puesto a puesto.
- Reemplazar o migrar las 28 características actuales.

## Decisions

### D1. Catálogo común de rasgos y pesos por puesto
Un único catálogo de 12 rasgos (spec `player-behavior-traits-rating`) y una matriz puesto × rasgo con tres valores (clave = 3, suma = 1, indiferente = 0). Alternativa descartada: lista de rasgos propia por puesto (unos 200 ítems, jugadores multi-puesto valorados varias veces). Consecuencia: el jugador se valora una vez; los pesos concentran la diferencia entre puestos. Los pesos por defecto viven en código y se pueden sobrescribir por equipo.

### D2. 8 puestos unificados sobre las 14 demarcaciones
Mapa fijo en código (ver spec `position-fit-ranking`). Izquierda y derecha comparten puesto. Se descartó añadir demarcaciones nuevas: carrilero, interior y media punta quedan cubiertos por Lateral/Carrilero, Mediocentro y Mediapunta, y un jugador ya puede tener varias demarcaciones posibles.

### D3. Capacidad y conducta separadas
Las 28 características no cambian. Las nuevas valoraciones por rasgos son otra entidad (`TeamPlayerTraitRating`) con otra escala (1–5). No se mezclan en un solo número: la diferencia entre «puede» y «lo hace» es la información nueva (caso Araque).

### D4. Escala de 5 niveles y desempate por orden
Con 5 niveles habrá empates; la resolución para decidir no sale de la escala sino de (a) la media ponderada con decimales, (b) la tendencia y (c) el orden manual por puesto. El orden manual confirmado es lo que consume la desconvocatoria.

### D5. Fit = media ponderada
Fit = Σ(nivel × peso) / Σ(peso) sobre los rasgos con peso mayor que 0 y con nivel. Sin rasgos con dato, no hay encaje y el jugador queda al final. Alternativa descartada: penalizar por rasgos clave sin valorar; se muestra como «sin dato» para no inventar notas.

### D6. Orden por puesto, semanal y por equipo
Entidad `TeamPositionFitOrder` (equipo, puesto, semana, lista ordenada de teamPlayerIds, indicador de corrección manual). Si no hay orden confirmado para la semana, el sistema devuelve el propuesto. Un jugador con varias demarcaciones posibles aparece en cada puesto candidato.

### D7. Encaje en el embudo de desconvocatoria
En el paso 3 del embudo, dentro de cada puesto con orden, el último del orden se desconvoca primero y la equidad solo desempata; los puestos sin orden siguen con la equidad actual. Protecciones y mínimos por posición siguen prevaleciendo (pasos 1 y 2). La tarjeta muestra puesto, lugar y encaje.

### D8. Confidencialidad y API
Dos endpoints de valoración (`GET .../trait-ratings/latest`, `POST .../trait-ratings`) y dos de encaje (`GET .../position-fit`, `PUT .../position-fit/{position}`), todos solo para Coach y Administrador del equipo. Un vertical slice por archivo, validador FluentValidation en cada comando, errores `ProblemDetails`, sin `SaveChangesAsync` manual salvo donde el patrón del proyecto lo exija (se sigue el de `CreateTeamRatings`).

### D10. Tablero por rasgo en la valoración de conducta
La valoración por rasgos ofrece «Por rasgo» (por defecto) y «Por jugador». El tablero por rasgo reutiliza `RatingSheetBoard` (niveles 1–5 y bandeja «Sin colocar») para ver dónde está cada jugador, igual que en Capacidad; la tarjeta por jugador se mantiene para valorar a uno de golpe. Ambas comparten el mismo borrador de `useTraitRating`.

### D9. UI
Tres vistas en `/coach/squad/rating-sheet`: hojas actuales (sin cambios), valoración por rasgos (tarjetas por jugador, selector 1–5, tendencia, nivel anterior marcado) y orden por puesto (tarjetas arrastrables con botones subir/bajar). Responsive desde 360 px, sin tablas, CSS Modules, `ConfirmDialog` al salir con cambios.

## Target State

El entrenador abre cada semana la valoración por rasgos, ajusta lo que ha cambiado y marca tendencia; en la vista por puesto ve el orden propuesto por encaje, lo corrige y lo confirma; la propuesta de desconvocatoria usa ese orden y explica el motivo en la tarjeta.

## Risks / Trade-offs

- Carga semanal: 12 rasgos × unos 20 jugadores. Se mitiga con arrastre y valorar solo cambios; medir el tiempo real en la primera semana de uso.
- Pesos por defecto discutibles: pueden sesgar el orden. Se mitiga con la corrección manual y con la configuración por equipo.
- Orden manual obsoleto si no se revisa: la semana sin orden confirmado vuelve al propuesto, y la tarjeta indica si el orden es manual.
- Doble sistema de valoración (capacidad y conducta) puede confundir. Se mitiga con nombres distintos en la UI («Capacidad» y «Conducta en partido»).
- Cambio de comportamiento del algoritmo de desconvocatoria: cubrir con tests de regresión sobre protecciones y mínimos.

## Migration Plan

Migración EF aditiva (tres tablas nuevas: valoraciones por rasgos con sus detalles, pesos por equipo y orden por puesto), sin backfill ni cambios en tablas existentes. Migración en commit separado. Rollback: revertir la migración; las hojas existentes no dependen de las tablas nuevas. Mientras no haya órdenes confirmados ni propuestos con datos, la desconvocatoria se comporta como hoy.

## Validation Strategy

- Backend (xUnit): cálculo de encaje (clave frente a suma, indiferente ignorado, sin datos), mapa demarcación→puesto, candidatos multi-puesto, validadores de lote (nivel fuera de rango, rasgo desconocido, jugador de otro equipo, duplicados, más de 100), 403 para jugador/familia y coach de otro equipo, atomicidad con base real.
- Frontend (Vitest): arrastre de la valoración anterior, solo cambios guardados, orden propuesto y desempate por tendencia, reordenar con botones, solo lectura para otros roles, confirmación al salir.
- Desconvocatoria: protegido nunca propuesto aunque tenga peor encaje, mínimos por posición prevalecen, puesto sin orden usa equidad, tarjeta con el motivo.
- La suite completa y los builds se ejecutan una sola vez al terminar todo el cambio.

## ADR / DDR Evaluation

Ninguno por ahora: el cambio añade una capacidad dentro de las convenciones existentes (vertical slice, CQRS, CSS Modules). Si el entrenador decide más adelante derivar los rasgos del modelo de juego, esa decisión sí merecería un DDR.

## Open Questions

- Origen de los rasgos: ¿catálogo fijo en código como en esta propuesta, o editable por el entrenador y enlazable a sub-subprincipios del modelo? La v1 asume fijo.
- Pesos por puesto: ¿bastan los valores por defecto más la sobrescritura por equipo, o el entrenador quiere editarlos en la propia página desde el primer día?
- ¿El mínimo por posición del embudo debe usar las 8 posiciones unificadas o seguir con los roles actuales de `deconvoke-proposal-positions`? La v1 deja los roles actuales para los mínimos y usa las 8 posiciones solo para el encaje.
