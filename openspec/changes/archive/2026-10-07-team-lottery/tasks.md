## 1. Dominio (~1,5h)

- [x] Red: `LotteryCampaignTests`:
  - crear con valores válidos e inválidos;
  - entregar, devolver y deshacer la devolución;
  - nº de taco duplicado y rangos solapados;
  - dinero fuera de rango o que no es múltiplo del precio;
  - devolución anterior a la entrega;
  - cambiar el precio con tacos (falla) y cambiar la ventana del club con tacos (se permite);
  - borrar un taco devuelto;
  - liquidación con el club.
- [x] Green: `LotteryCampaign`, `LotteryBook` y los `ErrorCodes` (design.md D1).
- **Verify**: `dotnet test --filter LotteryCampaignTests`.

## 2. Persistencia (~0,5h)

- [x] Configuraciones EF + `DbSet` (D2).
- [x] Migración `AddTeamLottery` (`--configuration Release`).
- [x] Red → Green (Postgres): persistir la campaña con sus tacos y releerla.

## 3. Endpoints (~2h)

- [x] Red: validators.
- [x] Red: handlers (Postgres):
  - flujo completo con los totales del escenario de la spec;
  - jugador de otro equipo → `404`;
  - Player solo ve sus tacos.
- [x] Red: autorización (Player y FamilyMember → `403` en las escrituras; otro equipo → `403`).
- [x] Green: `Features/Coaches/Lottery/*.cs` y `LotteryCampaignMapping.cs` (D3).
- [x] Subir la versión minor de la API.
- **Verify**: `dotnet build` y `dotnet test`.

## 4. Web: servicio y lógica (~1h)

- [x] Red: `lotteryHelpers.test.ts`:
  - sugerencias de nº de taco y primera papeleta;
  - estado del jugador;
  - filtros;
  - búsqueda con prioridad dorsal → alias → nombre y apellidos (sin mayúsculas ni acentos);
  - filtro inicial.
- [x] Green: `lotteryService.ts` y `lotteryHelpers.ts`.

## 5. Web: página (~2h)

- [x] Red: `Lottery.test.tsx`:
  - estado vacío;
  - tarjetas con el nº de taco;
  - entregar con los valores sugeridos;
  - devolución rápida «Todo vendido»;
  - modo lectura sin acciones.
- [x] Green:
  - `Lottery.tsx`;
  - `LotterySummary`, `LotteryPlayerCard`, `DeliverBookSheet`, `ReturnBookSheet`,
    `LotteryClubDeliveryCard` y `LotteryCampaignDialog`, con sus CSS Modules.
- [x] Revisión visual a 360 px y en escritorio (revisado por el usuario).
- [x] Subir la versión minor de la web.
- **Verify**: `npm run build` y `npm run test`.

## 6. Cierre

- [x] `openspec validate team-lottery --strict`.
- [x] Commits tras confirmación del usuario: migración, API y web por separado.
