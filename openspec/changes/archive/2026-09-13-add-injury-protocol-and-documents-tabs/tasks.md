## Backend (back-specialist)

### 1. Dominio y persistencia (~2h)
- [x] `Domain/Entities/Teams/TeamInjuryProtocol.cs` — `BaseEntity`, `TeamId`, `Content?`,
      `UpdatedAt`, `UpdatedByUserId?`, navegación `Attachments`. Factoría `Create(teamId)`,
      métodos `UpdateContent(content, userId)`, `ClearContent()`.
- [x] `Domain/Entities/Teams/TeamInjuryProtocolAttachment.cs` — `BaseEntity`, `ProtocolId`,
      `FileName`, `StorageUrl`, `ContentType`, `UploadedAt`. Factoría `Create(...)`.
- [x] `Infrastructure/Persistence/Configuration/Entities/TeamInjuryProtocolEntityConfiguration.cs`
      y `TeamInjuryProtocolAttachmentEntityConfiguration.cs` (índice único `TeamId`, cascade FK).
- [x] `AppDbContext.cs`: añadir los dos `DbSet<>`.
- [x] Migración EF: `dotnet ef migrations add AddTeamInjuryProtocol --startup-project
      Back/ExtractionApi/src/RFFM.Host` (ajustar ruta real del Host) desde
      `Back/ExtractionApi`.
- [x] Test unitario de dominio: `TeamInjuryProtocolTests.cs` (crear, actualizar contenido,
      limpiar contenido) — Red antes que Green.
- **Verificación**: `dotnet build`, `dotnet test --filter TeamInjuryProtocol`.

### 2. Endpoints (~2h)
- [x] Nuevo `Features/Coaches/Teams/InjuryProtocol/SetTeamInjuryProtocol.cs` (`IFeatureModule`):
      `GET`, `PUT`, `DELETE` del protocolo (ver design.md Decisión 3). Tests de integración
      primero (Red): rol Coach puede escribir, rol no-Coach recibe 403 en PUT/DELETE pero 200 en
      GET; GET sin protocolo devuelve `content: null`.
- [x] Mismo archivo o adyacente: `POST`/`DELETE` de adjuntos, usando `IStorageService` (bucket
      `injury-protocol-attachments`), validación de `content-type == application/pdf` y tamaño
      máximo. Tests: subida válida, rechazo de no-PDF, rechazo de rol no-Coach, descarga de la
      URL devuelta.
- **Verificación**: `dotnet build`, `dotnet test --filter InjuryProtocol`.

## Frontend (front-specialist)

### 3. Servicio y dependencia (~1h)
- [x] `npm install @tiptap/react @tiptap/starter-kit @tiptap/pm` en `Front/`.
- [x] `Front/src/apps/coach/services/injuryProtocolService.ts`: tipos de request/response +
      `getInjuryProtocol`, `updateInjuryProtocol`, `deleteInjuryProtocol`,
      `uploadInjuryProtocolAttachment`, `deleteInjuryProtocolAttachment`.
- [x] Test: `services/__tests__/injuryProtocolService.test.ts` (mock de `client`).

### 4. Pestaña Lesionados responsive (~2h)
- [x] Test primero: `pages/injured/components/__tests__/InjuredPlayersList.test.tsx` — verifica
      que NO se renderiza ningún `<table>`/`role="table"`, que se listan tarjetas, y que
      editar/dar de alta solo aparece para Coach.
- [x] Extraer `pages/injured/components/InjuredPlayersList.tsx` (+ `.module.css`) desde la tabla
      actual de `Injured.tsx`, convertido a tarjetas responsive.
- **Verificación**: `npm run test`, probar visualmente a ~375px y escritorio.

### 5. Pestaña Protocolo (~2h)
- [x] Test primero: `InjuryProtocolPanel.test.tsx` — Coach ve editor + botones Guardar/Eliminar;
      rol no-Coach ve contenido en solo lectura sin controles de edición; guardar llama al
      servicio y muestra snackbar de éxito (`rffm.show_snackbar`); eliminar usa `ConfirmDialog`,
      nunca `window.confirm`.
- [x] Implementar `InjuryProtocolPanel.tsx` (+ `.module.css`) con TipTap.
- **Verificación**: `npm run test`.

### 6. Pestaña Documentos (~2h)
- [x] Test primero: `InjuryProtocolDocuments.test.tsx` — todos los roles ven enlaces de
      descarga; solo Coach ve subir/eliminar; eliminar usa `ConfirmDialog`.
- [x] Implementar `InjuryProtocolDocuments.tsx` (+ `.module.css`), tarjetas responsive (no tabla).
- **Verificación**: `npm run test`.

### 7. Integración de pestañas en Injured.tsx (~1h)
- [x] Reestructurar `Injured.tsx` con `Tabs`/`Tab` (patrón `PlayerDetail.tsx`), 3 pestañas:
      Lesionados / Protocolo / Documentos. `variant="scrollable"` si hace falta en móvil.
- [x] Test: `Injured.tabs.test.tsx` — cambia de pestaña y renderiza el panel correspondiente.
- **Verificación**: `npm run build`, `npm run test` (suite completa de `injured`).

## Fix post-implementación: descarga de PDF abría pestaña en blanco
- [x] Causa raíz: `att.url` es la ruta relativa cruda devuelta por `IStorageService`
      (p.ej. `injury-protocol-attachments/{teamId}/{guid}.pdf`), no una URL navegable; el
      `<a href={att.url} target="_blank">` original navegaba a una ruta SPA inexistente.
      Además `GetPublicStorageFile.cs` no reconocía `.pdf` en su switch de content-type local
      (caía a `application/octet-stream`).
- [x] Backend: `Features/Infrastructure/GetPublicStorageFile.cs` y
      `Infrastructure/Storage/LocalStorageService.cs` (`GetContentType`) reconocen ahora `.pdf` →
      `application/pdf`. Test nuevo `IntegrationTests/GetPublicStorageFileTests.cs` (Red→Green).
- [x] Frontend: `InjuryProtocolDocuments.tsx` ya no usa un `<a href target="_blank">`; el nombre
      del fichero es texto simple y un nuevo botón de descarga (icono) llama a
      `fetchPublicStorageFile` (`shared/services/imageService.ts`, patrón ya usado para
      imágenes) para traer el PDF como blob y forzar la descarga vía
      `anchor.download = fileName`, igual que `trainingAttendanceExcel.ts`. Tests actualizados.
- **Verificación**: `dotnet test --filter "GetPublicStorageFile|InjuryProtocol"` (28/28),
  `npm run test -- InjuryProtocolDocuments` (7/7).

## Fix post-implementación: texto "Última actualización" oculto tras el pie en móvil
- [x] `InjuryProtocolPanel.tsx`/`.module.css`: la línea de "Última actualización" gana una clase
      `.updatedAt` con `padding-bottom` (8px escritorio, 24px en ≤700px) para no quedar pegada al
      borde inferior del área de scroll de `BaseLayout` (footer fijo, `--rffm-footer-h`).
- [x] `Injured.module.css`: `.tabPanel` gana algo más de `padding-bottom` (24px) en ≤600px como
      refuerzo general para el contenido de las 3 pestañas en móvil.
- **Verificación**: `npm run test -- InjuryProtocolPanel Injured` (30/30), `npm run build` OK.
  Ajuste puramente visual/CSS, sin test automatizado posible (frontend-testing.md §2.4: no
  testear estilos) — pendiente de confirmación visual del usuario en móvil real.

## Cierre
- [x] `dotnet build && dotnet test` (backend completo afectado) — 1223/1225 (2 fallos preexistentes no relacionados, `AdnLegibleImporter`/`GameModelSeeder`).
- [x] `npm run build && npm run test` (frontend completo afectado) — build OK, 295 archivos, 1519-1520 pasan / 3 skipped preexistentes (1 test de otra página flaky en la suite completa, verde en aislado).
- [ ] Prueba manual en navegador: subir un PDF, descargarlo, editar protocolo como Coach,
      confirmar solo-lectura como otro rol, comprobar responsive en las 3 pestañas.
- [x] Confirmar con el usuario antes de `git commit`/`git push` (regla `git.md` §6.3) — confirmado.
- [x] Archivar el change: mover a `openspec/changes/archive/2026-09-13-add-injury-protocol-and-documents-tabs/`.
