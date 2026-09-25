## ADDED Requirements

### Requirement: El tablero muestra las habilidades imprescindibles de cada sub-subprincipio
El tablero de contenido SHALL mostrar, para cada sub-subprincipio, sus habilidades imprescindibles
(`Habilidad.Nombre`) como chips, tanto en el árbol ADN del panel izquierdo como en los objetivos de
cada tarjeta de sesión. Las habilidades SHALL leerse del Modelo de Juego cargado, no de la sesión.
Cada chip SHALL ofrecer su descripción y si es entrenable; si la habilidad tiene `referenciaAKey`,
SHALL indicar "Igual que {referenciaAKey}". Un sub-subprincipio sin habilidades SHALL NOT mostrar
chips.

#### Scenario: Habilidades en el árbol ADN
- **WHEN** el sub-subprincipio 1.1.1 tiene las habilidades "Perfilamiento" y "Anticipación"
- **THEN** su fila en el árbol ADN muestra los chips "Perfilamiento" y "Anticipación"

#### Scenario: Habilidades en el objetivo de una sesión
- **WHEN** una sesión tiene como objetivo el sub-subprincipio 1.1.1
- **THEN** ese objetivo en la tarjeta de sesión muestra los chips "Perfilamiento" y "Anticipación"

#### Scenario: Detalle de una habilidad
- **WHEN** el entrenador pulsa o pasa el ratón por el chip "Perfilamiento"
- **THEN** se muestra su descripción y su texto de entrenable

#### Scenario: Habilidad que remite a otro sub-subprincipio
- **WHEN** una habilidad tiene `referenciaAKey` "1.2.3"
- **THEN** su detalle indica "Igual que 1.2.3"

#### Scenario: Sub-subprincipio sin habilidades
- **WHEN** un sub-subprincipio no tiene habilidades
- **THEN** no se muestra ningún chip de habilidad para él

### Requirement: El tablero permite editar o crear el Modelo de Juego y volver
El tablero de contenido SHALL ofrecer "Editar modelo" cuando el equipo tiene Modelo de Juego, que
abre `/coach/game-model/edit` para la temporada activa. Cuando el equipo no tiene modelo, el estado
vacío SHALL ofrecer "Crear modelo", que abre `/coach/game-model/create`. En ambos casos, al guardar
o cancelar en el editor, SHALL volverse al tablero con la misma URL (incluido `microcicloId` si lo
había) y el tablero SHALL mostrar el modelo actualizado.

#### Scenario: Editar el modelo desde el tablero
- **WHEN** el entrenador pulsa "Editar modelo" en el tablero abierto con el microciclo A
- **THEN** se abre el editor del modelo de la temporada activa y, al guardar, vuelve al tablero
  con `microcicloId` A

#### Scenario: Crear el modelo desde el tablero
- **WHEN** el equipo no tiene Modelo de Juego y el entrenador pulsa "Crear modelo"
- **THEN** se abre el editor de creación y, al guardar o cancelar, vuelve al tablero
