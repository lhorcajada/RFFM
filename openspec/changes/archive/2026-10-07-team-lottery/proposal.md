## Why

La página `coach/lottery` existe pero está vacía. Cada temporada el club entrega al equipo tacos
de lotería de Navidad: 15 papeletas numeradas por taco, a 5 € cada una. El entrenador reparte los
tacos a los jugadores, después los recoge con el dinero y liquida con el club entre el 9 y el 15
de diciembre. El sorteo es el 22.

Hoy el entrenador lo apunta en papel. Necesita saber a quién ha dado cada taco y cuándo, quién lo
ha devuelto, cuántas papeletas ha vendido y cuánto dinero lleva recogido. Todo esto lo hace en el
móvil, en el campo y con las manos ocupadas, así que registrar una entrega o una devolución tiene
que costar uno o dos toques.

## What Changes

- **Backend (`Back/ExtractionApi`)**:
  - Nuevas entidades `LotteryCampaign` (una campaña por equipo y sorteo, con precio, papeletas por
    taco, fecha del sorteo, ventana de entrega al club y la liquidación al club) y `LotteryBook`
    (taco: jugador, nº de taco, primera papeleta, fecha de entrega y devolución con el dinero).
  - Las papeletas vendidas, las sobrantes, el rango del taco y los totales se calculan; solo se
    guarda el dinero.
  - Migración `AddTeamLottery`.
  - Endpoints en `/api/teams/{teamId}/lottery-campaigns`, con el permiso `Lottery`: lectura para
    todos los roles con acceso (Player y FamilyMember solo ven sus propios tacos) y escritura para
    Coach, ClubDirector y Administrator.
  - **Versión**: API minor.
- **Web (`Front`)**:
  - `Lottery.tsx`, pensada para móvil:
    - resumen con los totales;
    - lista de jugadores en tarjetas con el nº de taco siempre visible;
    - filtros por estado y búsqueda por dorsal o nombre;
    - hojas inferiores para entregar el taco (nº sugerido, fecha de hoy) y para registrar la
      devolución (botones rápidos de dinero);
    - tarjeta de liquidación con el club.
  - **Versión**: web minor.

## Capabilities

### New Capabilities
- `team-lottery`: reparto, devolución y liquidación de los tacos de lotería del equipo.

## Impact

- `Back/ExtractionApi`:
  - `Domain/Entities/Teams/LotteryCampaign.cs` y `LotteryBook.cs`;
  - configuraciones EF, `AppDbContext` y la migración;
  - `Features/Coaches/Lottery/*.cs`;
  - `ErrorCodes`.
- `Front`:
  - `apps/coach/pages/lottery/` (página y componentes);
  - `apps/coach/services/lotteryService.ts`.
- **Fuera de alcance**:
  - Mobile (Expo);
  - control de papeletas sueltas (qué número concreto se vendió);
  - integración con la bolsa del equipo (`TeamFundMovement`): el dinero de la lotería es del club;
  - comprobar los premios del sorteo.
