## Contexto

`Injured.tsx` (`coach/injured?teamId=`) hoy es una única tabla MUI. Se pide: (1) hacerla
responsive con tarjetas, (2) añadir pestaña "Protocolo" (texto enriquecido, único por equipo,
solo el coach edita), (3) añadir pestaña "Documentos" (varios PDFs ligados al protocolo, solo el
coach sube/borra, todos descargan).

Patrones de referencia encontrados en el repo:
- `Domain/Entities/Teams/TeamFundMovement.cs` + `TeamFundMovementEntityConfiguration.cs` — entidad
  simple `BaseEntity`, factoría `Create()` con `ArgumentException`, sin Result<T> (este backend no
  usa ese patrón; ignorar `.claude/rules/dotnet.md`/`architecture.md`/`testing.md`, que documentan
  otro proyecto, `CVL.SmartLocks`, no este).
- `Features/Coaches/Players/Commands/SetPlayerSanction.cs` / `SetPlayerInjury.cs` — `IFeatureModule`
  con handlers inline (Minimal API), no Mediator/ICommand, para sub-recursos CRUD simples por
  equipo/jugador. GET abierto a todo autenticado, escritura con
  `[Authorize(Roles = "Coach,Administrator")]`.
- `Features/Coaches/Players/Commands/UploadPlayerPhoto.cs` — patrón de subida de fichero:
  `IFormFile` + `IStorageService.UploadAsync(bucket, fileName, file, ct)`, nombre de fichero
  `Guid.NewGuid() + extensión`.
- `Features/Coaches/Teams/Queries/GetTeamFund.cs` — ejemplo de query de equipo con Mediator
  (usado aquí solo como referencia de espacio de nombres `Features/Coaches/Teams/`).

## Decisión 1 — Backend: IFeatureModule inline, no Mediator

Igual que `SetPlayerSanction.cs`/`SetPlayerInjury.cs`, el protocolo y sus adjuntos son un
sub-recurso CRUD simple por equipo: se implementan como **un único `IFeatureModule`** con handlers
Minimal API inline, no como comandos/queries Mediator. Razón: es el patrón que ya siguen los
sub-recursos "por equipo" más cercanos (sanciones, lesiones), y evita introducir
FluentValidation/pipeline behaviors para una operación sin reglas de validación complejas.

## Decisión 2 — Modelo de datos

```
TeamInjuryProtocol (BaseEntity)
  TeamId: string (FK -> Team, único — un protocolo por equipo)
  Content: string (HTML enriquecido de TipTap, nullable hasta que el coach escribe algo)
  UpdatedAt: DateTime
  UpdatedByUserId: string?
  Team: Team (navegación)
  Attachments: ICollection<TeamInjuryProtocolAttachment>

TeamInjuryProtocolAttachment (BaseEntity)
  ProtocolId: string (FK -> TeamInjuryProtocol, cascade delete)
  FileName: string (nombre original mostrado al usuario)
  StorageUrl: string (URL devuelta por IStorageService.UploadAsync)
  ContentType: string ("application/pdf")
  UploadedAt: DateTime
  Protocol: TeamInjuryProtocol (navegación)
```

- `TeamId` en `TeamInjuryProtocol` con índice único: un protocolo por equipo. Si no existe fila,
  GET devuelve "sin protocolo todavía" (200 con `content: null, attachments: []`), no 404 — así el
  frontend no necesita distinguir "aún no creado" de error.
- Crear/editar el protocolo es un único endpoint `PUT` (upsert): si no existe fila para el
  `TeamId`, la crea; si existe, actualiza `Content`. Evita duplicar POST-vs-PUT para un recurso
  singleton.
- `DELETE` del protocolo borra el `Content` (lo deja `null`) pero conserva la fila y sus adjuntos
  — "eliminar el protocolo" significa borrar el texto, no los documentos ya subidos (los
  documentos se borran individualmente en su propia pestaña). Si se quiere aclarar lo contrario,
  confirmar con el usuario antes de implementar.

## Decisión 3 — Endpoints

Todos bajo `Features/Coaches/Teams/InjuryProtocol/SetTeamInjuryProtocol.cs` (un único
`IFeatureModule`, mismo namespace que `GetTeamFund.cs`):

```
GET    /api/catalog/team/{teamId}/injury-protocol
         -> { teamId, content, updatedAt, attachments: [{ id, fileName, url, uploadedAt }] }
         RequireAuthorization() (todo rol autenticado)

PUT    /api/catalog/team/{teamId}/injury-protocol      { content: string }
         -> upsert Content, devuelve el protocolo actualizado
         [Authorize(Roles = "Coach,Administrator")]

DELETE /api/catalog/team/{teamId}/injury-protocol
         -> pone Content a null (conserva adjuntos)
         [Authorize(Roles = "Coach,Administrator")]

POST   /api/catalog/team/{teamId}/injury-protocol/attachments   (multipart/form-data, IFormFile)
         -> sube a IStorageService (bucket nuevo "injury-protocol-attachments"), crea la fila,
            devuelve { id, fileName, url, uploadedAt }
         [Authorize(Roles = "Coach,Administrator")]
         .DisableAntiforgery() (igual que UploadPlayerPhoto)

DELETE /api/catalog/team/{teamId}/injury-protocol/attachments/{attachmentId}
         -> IStorageService.DeleteAsync(bucket, ...) + borra la fila
         [Authorize(Roles = "Coach,Administrator")]
```

- Descarga de PDF: el frontend usa directamente la `url` devuelta por `IStorageService` (mismo
  patrón que las fotos de jugador/club — `LocalStorageService`/`SupabaseStorageService` ya sirven
  ficheros públicamente vía URL). No hace falta un endpoint de descarga dedicado.
  **Actualización post-implementación**: esto resultó impreciso — la `url` de `LocalStorageService`
  es una ruta relativa cruda ("bucket/path"), no navegable directamente; la descarga real pasa por
  `GET /api/public/storage?url=` (`Features/Infrastructure/GetPublicStorageFile.cs`), igual que las
  imágenes (`shared/services/imageService.ts#fetchPublicStorageFile`). Ver tasks.md, sección "Fix
  post-implementación: descarga de PDF abría pestaña en blanco".
- Validación de fichero: solo `content-type == "application/pdf"`, tamaño máximo razonable (p.ej.
  10 MB) — replicar el estilo de `UploadPlayerPhotoValidator` pero como `FluentValidation`
  opcional o comprobación inline (seguir lo que haga `SetPlayerSanction.cs`/`SetPlayerInjury.cs`
  para inputs simples: comprobación inline con `Results.ValidationProblem`, sin validator
  separado, ya que el resto del feature no usa Mediator/FluentValidation).

## Decisión 4 — Migración y DbContext

- Nueva migración EF (schema `app`): tablas `TeamInjuryProtocols` y
  `TeamInjuryProtocolAttachments`, índice único en `TeamInjuryProtocols.TeamId`, FK cascade de
  `TeamInjuryProtocolAttachments.ProtocolId` -> `TeamInjuryProtocols.Id`.
- `AppDbContext`: añadir `DbSet<TeamInjuryProtocol> TeamInjuryProtocols` y
  `DbSet<TeamInjuryProtocolAttachment> TeamInjuryProtocolAttachments`.
- EF configs en `Infrastructure/Persistence/Configuration/Entities/`:
  `TeamInjuryProtocolEntityConfiguration.cs`, `TeamInjuryProtocolAttachmentEntityConfiguration.cs`
  (descubiertas por reflexión, sin registro manual — igual que el resto).

## Decisión 5 — Frontend: estructura de pestañas

`Injured.tsx` pasa a usar el patrón de `PlayerDetail.tsx` (MUI `Tabs`/`Tab` + estado
`activeTab` + render condicional), 3 pestañas: "Lesionados", "Protocolo", "Documentos".

- **Lesionados**: se extrae el contenido actual de la tabla a un nuevo componente
  `pages/injured/components/InjuredPlayersList.tsx` que renderiza **tarjetas** (`Card`/`Paper`)
  en vez de `Table`/`TableRow` — un layout tipo lista/grid que se apila en móvil. Misma lógica de
  datos (`getTeamInjuries`), mismas acciones (editar vía `InjuryDialog`, dar de alta), visibles
  solo si el rol es Coach (seguir el check de rol ya existente en el archivo actual).
- **Protocolo**: nuevo componente `pages/injured/components/InjuryProtocolPanel.tsx`. Usa
  `@tiptap/react` + `@tiptap/starter-kit`. Coach: editor completo (toolbar básica: negrita,
  cursiva, listas, títulos) + botón Guardar (`PUT`) y botón Eliminar protocolo
  (`ConfirmDialog`, nunca `window.confirm` — regla `react.md` §10.1) que hace `DELETE`. Otros
  roles: el mismo editor de TipTap en modo `editable: false` (renderiza el HTML guardado de forma
  consistente con el editor, sin depender de `dangerouslySetInnerHTML` a mano).
- **Documentos**: nuevo componente `pages/injured/components/InjuryProtocolDocuments.tsx`. Lista
  de tarjetas, una por PDF (nombre, fecha de subida, botón descargar `<a href={url} target="_blank">`
  para todos; botones subir (input file) y eliminar (`ConfirmDialog`) solo visibles para Coach.
  **Actualización post-implementación**: el `<a href target="_blank">` directo se sustituyó por un
  botón de descarga que usa `fetchPublicStorageFile` + blob + `anchor.download` (ver Decisión 3 y
  tasks.md).
- Nuevo servicio `Front/src/apps/coach/services/injuryProtocolService.ts`: `getInjuryProtocol`,
  `updateInjuryProtocol`, `deleteInjuryProtocol`, `uploadInjuryProtocolAttachment` (FormData, sigue
  el patrón de `uploadPlayerPhoto` en `playerService.ts`), `deleteInjuryProtocolAttachment`. Un
  único cliente Axios (`core/api/client.ts`), sin instancias nuevas.
- CSS Modules nuevos: `InjuredPlayersList.module.css`, `InjuryProtocolPanel.module.css`,
  `InjuryProtocolDocuments.module.css` — sin estilos inline, sin `styled()`.
- Nueva dependencia `package.json`: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` (peer
  requerido). Confirmado con el usuario (no había ningún editor de texto enriquecido instalado).

## Decisión 6 — Responsive / prohibición de tablas

Las 3 pestañas deben probarse a ~360-400px de ancho (regla `react.md` §4 /
`frontend-architecture.md` §7): la lista de lesionados y la de documentos usan tarjetas apiladas,
nunca `<table>`; la barra de pestañas (`Tabs`) usa `variant="scrollable"` si no caben las 3
etiquetas en móvil (mismo ajuste que ya podría necesitar `PlayerDetail.tsx`, comprobar si ya lo
hace y replicarlo).

## No Goals

- No se versiona el histórico de cambios del protocolo (solo el contenido actual + `UpdatedAt`).
- No se añade un endpoint de descarga proxy; se confía en la URL pública del storage existente
  (matizado post-implementación: se usa el endpoint genérico ya existente
  `/api/public/storage`, no uno nuevo — ver Decisión 3).
- No se toca `Mobile/` en este cambio (el usuario no lo ha pedido).
