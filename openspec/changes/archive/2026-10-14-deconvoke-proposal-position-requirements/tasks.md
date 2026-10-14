## 1. Backend: demarcaciones en el listado de jugadores (~1h)

- [x] 1.1 Red: `tests/RFFM.Api.Tests/UnitTests/GetPlayersByTeamDemarcationsTests.cs` (Postgres,
  patrón de tests existentes):
  - jugador con activa 6 y posibles [6, 8] → `ActivePositionId` 6, `PossibleDemarcationIds`
    [6, 8], `Position` «Medio Centro»;
  - jugador sin demarcación → `null` y `[]`.
- [x] 1.2 Green: `GetPlayersByTeam.cs` (D1).
- [x] 1.3 `Directory.Build.props` → `1.26.0`.
- **Verify**: `dotnet test --filter "GetPlayersByTeam"`; `dotnet build`.

## 2. Front: módulo de requisitos por posición (~2h)

- [x] 2.1 Red: `utils/__tests__/positionRequirements.test.ts`:
  - roles por id (LIB → central, ED → banda, MCO → mediapunta, SD → delantero, 0/null → null);
  - fallback por nombre («Líbero», «extremo derecho») y subcadenas;
  - plantilla completa → sin `shortfalls`;
  - 2 centrales → «Centrales: quedan 2 de 3»;
  - reserva: 1 lateral + central con LD posible y 4 centrales → cumple laterales; con solo 3
    centrales no puede ser reserva (sin excedente);
  - cobertura de banda: 3 de banda y nadie más → «Cobertura de banda»; con un MC que tiene EI
    posible → cumple;
  - cobertura de delantero: 1 DC + MCO con DC posible → cumple; solo 1 DC → déficit.
- [x] 2.2 Green: `utils/positionRequirements.ts` (D2).
- **Verify**: `npm run test -- positionRequirements`.

## 3. Front: selección en la propuesta (~2h)

- [x] 3.1 Red: `utils/__tests__/deconvokeProposal.positions.test.ts` (fixtures mínimas de
  `BuildProposalInput`, puntuaciones controladas con valoraciones):
  - 4 defensas entre las puntuaciones más bajas → solo sale el central sobrante;
  - un solo delantero → el MCO que puede jugar de delantero queda protegido, con el factor
    `positionProtection`;
  - 4 de banda sin polivalentes → ninguno propuesto;
  - dentro de una línea con margen sale el de menor puntuación;
  - un central obligatorio con solo 3 centrales → propuesto + aviso «Centrales: quedan 2 de 3»;
  - mínimos imposibles → se alcanza `targetCount` y se listan todos los avisos;
  - se mantiene que quede al menos un portero (caso actual);
  - `positionRole` en cada jugador.
- [x] 3.2 Green: `teamplayerService.ts` (tipos), `deconvokeProposal.ts` (D3, D4) y limpieza (D6).
- **Verify**: `npm run test -- deconvokeProposal rules`.

## 4. Front: UI de la propuesta (~1h)

- [x] 4.1 Red: `components/__tests__/ConvocationTab.positionWarnings.test.tsx`:
  - con avisos → la cabecera muestra «Centrales: quedan 2 de 3»;
  - sin avisos → no hay alerta;
  - la tarjeta muestra «Central» / «Sin posición» y el factor «Protegido: …».
- [x] 4.2 Green: `ConvocationTab.tsx` (D5).
- [x] 4.3 `npm version 1.48.0 --no-git-tag-version`.
- [ ] 4.4 Comprobación visual a 360px y en escritorio (tema Coach).
- **Verify**: `npm run build`; `npm run test` (suite completa en verde).

## 5. Cierre

- [x] 5.1 `openspec validate deconvoke-proposal-position-requirements --strict`.
- [x] 5.2 Commits (`feat(mcp-api)` y `feat(front)` por separado), solo tras la confirmación del
  usuario.
