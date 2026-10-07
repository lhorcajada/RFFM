## Context

- El equipo es por temporada (`Team.SeasonId`), así que «campaña del equipo» ya equivale a
  «campaña de esa temporada».
- Permisos ya sembrados para `CoachFeatureRoutes.Lottery` (`/coach/lottery`):
  - Coach y ClubDirector: `ReadWrite` (3);
  - Player y FamilyMember: `Read` (1);
  - Administrator: se salta la comprobación.
  - Se aplican con `IRequireFeaturePermission` + `IRequireTeamMembership` (patrón de
    `SaveSessionEvaluation.cs`).
- Player y FamilyMember se resuelven a su jugador con `UserTeam.LinkedTeamPlayerId`.
- `DomainException(título, mensaje, código)` → `400` ProblemDetails; `NotFoundException` → `404`.
- Web:
  - `useTeamAndClub` (equipo seleccionado);
  - `useTeamRoster` (plantilla cacheada con dorsal, alias y foto);
  - `BaseLayout` + `ContentLayout`, `EmptyState`, `ConfirmDialog`;
  - bus `rffm.show_snackbar`.
  - `Sanctions.tsx` + `SanctionsSummaryCards` es la página hermana más parecida.

## Decisions

### D1 · Dominio (`Domain/Entities/Teams/`)

```csharp
public class LotteryCampaign : BaseEntity
{
    public string TeamId { get; private set; }
    public string Name { get; private set; }                 // «Lotería de Navidad 2026», ≤ 100
    public DateOnly DrawDate { get; private set; }           // 22/12
    public decimal TicketPrice { get; private set; }         // 5 €, > 0
    public int TicketsPerBook { get; private set; }          // 15, 1..100
    public DateOnly ClubDeliveryFrom { get; private set; }   // 09/12
    public DateOnly ClubDeliveryTo { get; private set; }     // 15/12, ≥ From, ≤ DrawDate
    public DateOnly? ClubDeliveredOn { get; private set; }
    public decimal? ClubDeliveredAmount { get; private set; }
    public IReadOnlyCollection<LotteryBook> Books => _books;

    public static LotteryCampaign Create(string teamId, string name, DateOnly drawDate, decimal ticketPrice,
        int ticketsPerBook, DateOnly clubDeliveryFrom, DateOnly clubDeliveryTo);
    public void Update(...);                                  // mismos parámetros
    public LotteryBook DeliverBook(string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn);
    public void EditBook(string bookId, string teamPlayerId, int bookNumber, int firstTicketNumber, DateOnly deliveredOn);
    public void ReturnBook(string bookId, decimal amount, DateOnly returnedOn);
    public void UndoReturn(string bookId);
    public void RemoveBook(string bookId);
    public void RecordClubDelivery(decimal amount, DateOnly deliveredOn);
    public void UndoClubDelivery();
}

public class LotteryBook : BaseEntity
{
    public string LotteryCampaignId { get; private set; }
    public string TeamPlayerId { get; private set; }
    public int BookNumber { get; private set; }               // nº de taco, > 0
    public int FirstTicketNumber { get; private set; }        // ≥ 0
    public DateOnly DeliveredOn { get; private set; }
    public DateOnly? ReturnedOn { get; private set; }
    public decimal? AmountReturned { get; private set; }      // null = no devuelto
}
```

Los valores calculados no se guardan:
- `LastTicketNumber = First + TicketsPerBook − 1`;
- `TicketsSold = AmountReturned / TicketPrice`;
- `TicketsUnsold = TicketsPerBook − TicketsSold`.

Invariantes (`DomainException`, código entre paréntesis):
- nº de taco único en la campaña (`LotteryBookNumberDuplicated`);
- el rango de papeletas no se solapa con el de otro taco de la campaña (`LotteryTicketRangeOverlap`);
- dinero devuelto entre 0 y `TicketPrice × TicketsPerBook`, y múltiplo de `TicketPrice`
  (`LotteryInvalidReturnAmount`);
- no se puede devolver antes de la fecha de entrega (`LotteryReturnBeforeDelivery`);
- no se cambian `TicketPrice` ni `TicketsPerBook` si ya hay tacos (`LotteryCampaignHasBooks`). El
  nombre, la fecha del sorteo y la ventana de entrega al club **sí** se pueden cambiar en cualquier
  momento, aunque ya haya tacos o liquidación: el club puede mover la ventana a mitad de campaña.
  Ninguna ventana viene fija en el código; los valores de Navidad solo rellenan el diálogo de
  creación;
- no se borra la campaña si tiene tacos (`LotteryCampaignHasBooks`);
- no se borra un taco ya devuelto: primero hay que deshacer la devolución (`LotteryBookAlreadyReturned`);
- ventana de entrega al club válida y no posterior al sorteo (`LotteryInvalidClubDeliveryWindow`);
- nombre obligatorio de 100 caracteres como máximo, precio > 0 y papeletas por taco entre 1 y 100
  (`LotteryInvalidCampaign`);
- liquidación con el club ≥ 0 (`LotteryInvalidClubDeliveryAmount`);
- taco inexistente → `NotFoundException` `LotteryBookNotFound`; campaña de otro equipo o inexistente →
  `LotteryCampaignNotFound`.

Varios tacos por jugador están permitidos: no hay unicidad por jugador.

La liquidación al club admite cualquier importe ≥ 0 (puede haber descuadres). La web muestra la
diferencia con lo recaudado, pero el dominio no la bloquea.

### D2 · Persistencia

- Tablas `app.LotteryCampaigns` y `app.LotteryBooks`, con `decimal(10,2)`.
- Índice único `(LotteryCampaignId, BookNumber)`. El solape de rangos lo comprueba el dominio.
- FKs:
  - `Team` → Cascade;
  - `LotteryBook` → `LotteryCampaign`: Cascade;
  - `TeamPlayer` → **Restrict**: no se pierde un taco con dinero si se borra al jugador.
- Colección mapeada por su campo privado (`UsePropertyAccessMode(Field)`).
- Migración `AddTeamLottery` en commit propio.

### D3 · API — `Features/Coaches/Lottery/` (un archivo por endpoint)

Base: `/api/teams/{teamId}/lottery-campaigns`.
- Todos los comandos y queries implementan `IRequireFeaturePermission` (`FeatureRoute = Lottery`;
  `Read` en los `GET`, `ReadWrite` en el resto) e `IRequireTeamMembership`.
- Todas las rutas usan `.RequireAuthorization()`.

| Archivo | Método y ruta | Respuesta |
|---|---|---|
| `GetLotteryCampaigns.cs` | `GET /` | `200` `[{ id, name, drawDate }]` ordenado por `drawDate` desc |
| `GetLotteryCampaign.cs` | `GET /{campaignId}` | `200` `LotteryCampaignDto` |
| `CreateLotteryCampaign.cs` | `POST /` | `201` `LotteryCampaignDto` |
| `UpdateLotteryCampaign.cs` | `PUT /{campaignId}` | `200` `LotteryCampaignDto` |
| `DeleteLotteryCampaign.cs` | `DELETE /{campaignId}` | `204` |
| `DeliverLotteryBook.cs` | `POST /{campaignId}/books` | `201` `LotteryCampaignDto` |
| `UpdateLotteryBook.cs` | `PUT /{campaignId}/books/{bookId}` | `200` `LotteryCampaignDto` |
| `DeleteLotteryBook.cs` | `DELETE /{campaignId}/books/{bookId}` | `200` `LotteryCampaignDto` |
| `ReturnLotteryBook.cs` | `PUT /{campaignId}/books/{bookId}/return` | `200` `LotteryCampaignDto` |
| `UndoLotteryBookReturn.cs` | `DELETE /{campaignId}/books/{bookId}/return` | `200` `LotteryCampaignDto` |
| `RecordLotteryClubDelivery.cs` | `PUT /{campaignId}/club-delivery` | `200` `LotteryCampaignDto` |
| `UndoLotteryClubDelivery.cs` | `DELETE /{campaignId}/club-delivery` | `200` `LotteryCampaignDto` |

Las escrituras sobre tacos devuelven la campaña completa recalculada. Así la web sustituye su
estado con una sola respuesta y los totales nunca se desincronizan.

```csharp
public record LotteryBookDto(string Id, string TeamPlayerId, int BookNumber, int FirstTicketNumber,
    int LastTicketNumber, DateOnly DeliveredOn, DateOnly? ReturnedOn, decimal? AmountReturned,
    int? TicketsSold, int? TicketsUnsold);
public record LotteryTotalsDto(int BooksDelivered, int BooksReturned, int BooksPending,
    int TicketsDelivered, int TicketsSold, int TicketsUnsold, int TicketsPending,
    decimal AmountCollected, decimal AmountPending);   // AmountPending = tickets pendientes × precio
public record LotteryCampaignDto(string Id, string Name, DateOnly DrawDate, decimal TicketPrice,
    int TicketsPerBook, DateOnly ClubDeliveryFrom, DateOnly ClubDeliveryTo,
    DateOnly? ClubDeliveredOn, decimal? ClubDeliveredAmount,
    LotteryTotalsDto Totals, IReadOnlyList<LotteryBookDto> Books, bool CanEdit);
```

- El mapeo a DTO y el cálculo de totales viven en `LotteryCampaignMapping.cs`, dentro de la
  carpeta de la feature y compartido por los handlers.
- Player y FamilyMember: `GetLotteryCampaign` filtra `Books` a su `LinkedTeamPlayerId` y calcula los
  totales sobre esos tacos. `CanEdit = false`.
- Validators:
  - ids no vacíos;
  - `BookNumber > 0` y `FirstTicketNumber ≥ 0`;
  - `Amount ≥ 0`;
  - `Name` obligatorio, de 100 caracteres como máximo;
  - `TicketPrice > 0` y `TicketsPerBook` entre 1 y 100.
- Fechas:
  - `deliveredOn` y `returnedOn` son opcionales en el body; si faltan, hoy (UTC);
  - `teamPlayerId` debe ser del equipo; si no, `404 TeamPlayerNotFound`.

### D4 · Web — `apps/coach/pages/lottery/`

`lotteryService.ts` tiene una función por endpoint y sus tipos (`type`, no `interface`).

Estructura de la página (mobile-first, sin tablas):

```
┌─────────────────────────────────┐
│ Lotería de Navidad 2026  [▼][⚙] │  selector de campaña + editar
│ Sorteo 22/12 · Club 9–15 dic    │
├─────────────────────────────────┤
│ ┌──────┐┌──────┐┌──────┐┌─────┐ │  LotterySummary (scroll horizontal en móvil)
│ │12/14 ││ 9    ││ 98   ││490 €│ │  tacos devueltos/entregados · pendientes
│ │tacos ││pend. ││vend. ││recog│ │  papeletas vendidas · dinero recogido
│ └──────┘└──────┘└──────┘└─────┘ │
├─────────────────────────────────┤
│ 🔍 dorsal o nombre              │
│ [Sin taco 4][Por devolver 9][Devueltos 3]
├─────────────────────────────────┤
│ ⑦ Pablo G.            Taco 12   │  LotteryPlayerCard
│   166–180 · entregado 02/12     │  toque → hoja «Devolución»
│                 [Devolver]      │
├─────────────────────────────────┤
│ ⑩ Hugo M.         Taco 13  ✔    │
│   181–195 · 60 € · 12 vend.     │
├─────────────────────────────────┤
│ ⑪ Leo R.            Sin taco    │  toque → hoja «Entregar taco»
│                 [Entregar]      │
├─────────────────────────────────┤
│ Liquidación con el club         │  LotteryClubDeliveryCard
│ Recogido 490 € · [Entregar al club]
└─────────────────────────────────┘
```

Rapidez de uso:
- **Entregar** (`DeliverBookSheet`, `Drawer anchor="bottom"`):
  - nº de taco sugerido = mayor nº + 1;
  - primera papeleta sugerida = mayor `LastTicketNumber` + 1 (o 1 si no hay tacos);
  - rango calculado en vivo;
  - fecha = hoy (editable);
  - un toque en «Entregar» registra y cierra.
- **Devolver** (`ReturnBookSheet`):
  - nº de taco y rango en la cabecera;
  - botón grande «Todo vendido · 75 €»;
  - campo de dinero con `−5 €` / `+5 €` (paso = precio) y botón «Nada vendido · 0 €»;
  - vendidas y sobrantes en vivo;
  - fecha = hoy.
- **Búsqueda sin escribir**:
  - tarjetas ordenadas por dorsal;
  - filtros de estado con contador;
  - el filtro inicial es «Sin taco» si quedan jugadores sin taco y, si no, «Por devolver»;
  - el campo de búsqueda busca por este orden de prioridad: dorsal exacto, alias y, por último,
    nombre y apellidos. Los resultados salen agrupados en ese orden. No distingue mayúsculas ni
    acentos y busca por inicio de palabra. El teclado numérico aparece primero
    (`inputMode="numeric"` con un conmutador `ABC`).
- **Varios tacos**:
  - la tarjeta del jugador lista cada taco con su número;
  - el menú `⋮` incluye «Entregar otro taco», «Editar taco», «Deshacer devolución» y
    «Eliminar taco» (este último con `ConfirmDialog`).
- **Club**: `LotteryClubDeliveryCard`
  - muestra la ventana de entrega de la campaña, editable desde ahí mismo (abre
    `LotteryCampaignDialog`);
  - resalta la ventana de entrega cuando hoy cae dentro de ella;
  - registra la liquidación con el importe sugerido = recaudado;
  - muestra la diferencia si no cuadra.
- **Sin campaña**: `EmptyState` con «Crear campaña». El diálogo viene relleno con:
  - nombre «Lotería de Navidad {año}»;
  - sorteo el 22/12;
  - 5 € y 15 papeletas;
  - entrega al club del 9/12 al 15/12.
- **Solo lectura** (`CanEdit = false`): sin botones ni hojas; solo los tacos propios y sus totales.
- **Avisos**: éxito y error por `rffm.show_snackbar`, con el error del backend (`detail`) o un texto en
  español por defecto.

Componentes, cada uno con su `.module.css`:
- `LotterySummary`;
- `LotteryPlayerCard`;
- `DeliverBookSheet`;
- `ReturnBookSheet`;
- `LotteryClubDeliveryCard`;
- `LotteryCampaignDialog`.

Las reglas de cálculo puras (sugerencias, estado del jugador, filtrado) van en `lotteryHelpers.ts`
para testearlas sin la UI.

## Tests

- **Dominio** (`LotteryCampaignTests`):
  - crear con valores válidos e inválidos;
  - entregar, devolver y deshacer la devolución;
  - nº de taco duplicado y rangos solapados;
  - dinero fuera de rango o que no es múltiplo del precio;
  - devolución anterior a la entrega;
  - cambiar el precio con tacos;
  - borrar un taco devuelto;
  - liquidación con el club.
- **Handlers (Postgres)**:
  - flujo completo: crear, entregar, devolver y liquidar, con totales correctos;
  - jugador de otro equipo → `404`;
  - Player solo ve sus tacos.
- **Autorización**:
  - Player y FamilyMember → `403` en las escrituras;
  - otro equipo → `403`.
- **Web**:
  - `lotteryHelpers`: sugerencias y filtros;
  - `Lottery.tsx`:
    - estado vacío;
    - lista con taco visible;
    - entregar y devolver con el botón rápido llaman al servicio con el body correcto;
    - en modo lectura no hay acciones.
