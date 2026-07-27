## Why

Hoy jugadores y padres/tutores no tienen ninguna vía digital para consultar convocatorias, calendario, resultados o comunicados del equipo: todo pasa por canales manuales (WhatsApp, papel, boca a boca). El entrenador y cuerpo técnico ya gestionan esa información dentro de la app Coach (`Front/src/apps/coach`), pero no existe ningún cliente pensado para las familias. Se propone una nueva app cliente en React Native (Expo, managed workflow) que consuma la misma API (`Back/ExtractionApi`), dirigida a los roles Identity `Player` y `FamilyMember` que ya existen en `AppRoles.cs`.

## What Changes

- **Nueva app**: `Mobile/` en la raíz del repo (hermana de `Front/` y `Back/`), proyecto Expo/TypeScript independiente. Código compartido con `Front/` se duplica por ahora (sin npm workspaces).
- **Auth móvil**: login nativo JWT directo (usuario/contraseña → JWT vía un endpoint de login existente o uno nuevo específico), sin el flujo de temp-token HS256 que hoy es exclusivo del front web. Token en `expo-secure-store`.
- **Modelo de acceso**: por equipo, reutilizando `UserTeam`/`Membership`/`LinkedTeamPlayerId` (`Domain/Aggregates/UserClubs`) ya existentes. Un usuario `FamilyMember` puede tener acceso a varios equipos de forma independiente (varias filas `UserTeam`), cada una vinculada a un jugador concreto (`LinkedTeamPlayerId`).
- **MVP funcional (solo lectura + una escritura)**: calendario de entrenamientos/partidos, convocatorias, resultados, comunicados del entrenador (lectura); confirmación/rechazo de asistencia a un evento (escritura).
- **Gestión por el entrenador**: qué ve la app móvil se apoya en `IRequireFeaturePermission`/`FeaturePermissionBehavior` (`Back/ExtractionApi/src/RFFM.Api/Common`), ya en uso real en `Features/Coaches/**`.

## Non-Goals

- Chat/mensajería tipo WhatsApp entre familia y cuerpo técnico: fuera de este MVP, se define en una fase posterior.
- No se usa `PagePermission` (existe en BD pero sin ningún consumidor real hoy; no se reactiva sin necesidad concreta).
- No se migra `Front/` a npm workspaces ni se extrae un paquete de tipos compartido en este cambio.
- No se implementan notificaciones push todavía (puede requerir un cambio posterior).

## Impact

- **Back**: nuevos endpoints de lectura para Player/FamilyMember (calendario, convocatorias, resultados, comunicados) + endpoint de confirmación de asistencia + endpoint/flujo de login JWT directo para móvil. Posible extensión de `IRequireFeaturePermission` para las nuevas rutas.
- **Front**: nuevo directorio `Mobile/` (Expo), sin tocar `Front/` existente salvo si se decide reutilizar tipos por referencia (a valorar en design.md).
