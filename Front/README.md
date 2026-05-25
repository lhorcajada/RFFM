# FUTBOL BASE App

Proyecto inicial Vite + React con Material UI y CSS Modules.

Requisitos:

- Node.js 18+ recomendado
- npm

Comandos:

```powershell
npm install
npm run dev
npm run build
npm run preview
```

Estructura:

- `index.html` - entrada
- `src/main.jsx` - punto de arranque React
- `src/App.jsx` - componente de ejemplo (usa MUI y CSS Modules)
- `src/App.module.css` - estilos con CSS Modules

Notas:

- Material UI v5 usa Emotion como motor CSS; ya está incluido en `package.json`.
 
Base de datos (migraciones EF Core — backend)
-------------------------------------------

Esta sección muestra comandos útiles para gestionar migraciones EF Core del backend (proyecto `RFFM.Api`) usando `AppDbContext`. Ejecuta los comandos desde la raíz del repo. Ajusta rutas si trabajas desde otra carpeta.

Contexto (rutas usadas en los ejemplos)
- Proyecto (Db): `Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj`
- Proyecto de arranque (startup): `Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj`
- DbContext: `AppDbContext`

Directorio recomendado
----------------------

Sitúate en `Back/ExtractionApi/src` (ruta relativa desde la raíz del repo) antes de ejecutar la mayoría de los comandos de migraciones. Ejemplos:

```bash
cd Back/ExtractionApi/src
# o, para ejecutar desde el proyecto API:
cd Back/ExtractionApi/src/RFFM.Api
```

Si estás en `Back/ExtractionApi/src`, los comandos de ejemplo en este README usan rutas relativas como `--project RFFM.Api/RFFM.Api.csproj --startup-project RFFM.Host/RFFM.Host.csproj`.

1) Añadir una migración
PowerShell:
```powershell
$proj="C:/Proyects/MisProyectos/RFFM/Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj"
$startup="C:/Proyects/MisProyectos/RFFM/Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj"
dotnet ef migrations add <MigrationName> --context AppDbContext --project $proj --startup-project $startup
```
Bash:
```bash
dotnet ef migrations add <MigrationName> --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
```

2) Aplicar migraciones (actualizar la base de datos)
```bash
dotnet ef database update --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
```

3) Eliminar la última migración SOLO del código
- Útil cuando la migración aún NO se ha aplicado en la BD.
```bash
dotnet ef migrations remove --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
```

4) Eliminar la última migración del código y de la base de datos
- Flujo seguro:
	1. Listar migraciones y anotar el nombre de la migración anterior.
	2. Revertir la BD a la migración anterior.
	3. Eliminar la migración del código.

```bash
# 1) listar
dotnet ef migrations list --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj

# 2) revertir BD a la migración previa (reemplaza <PrevMigrationName>)
dotnet ef database update <PrevMigrationName> --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj

# 3) eliminar la última migración del código
dotnet ef migrations remove --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
```

5) Eliminar todas las migraciones del código y de la base de datos
- Flujo seguro:
	1. Revertir la BD a 0.
	2. Eliminar las migraciones del código (repetir `migrations remove` hasta que no queden).

PowerShell (ejemplo automatizado):
```powershell
$proj="C:/Proyects/MisProyectos/RFFM/Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj"
$startup="C:/Proyects/MisProyectos/RFFM/Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj"
dotnet ef database update 0 --context AppDbContext --project $proj --startup-project $startup
while ((dotnet ef migrations list --context AppDbContext --project $proj --startup-project $startup).Trim() -ne "") {
	dotnet ef migrations remove --context AppDbContext --project $proj --startup-project $startup
}
```

Bash (manual):
```bash
dotnet ef database update 0 --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
# Ejecuta repetidamente:
dotnet ef migrations remove --context AppDbContext --project Back/ExtractionApi/src/RFFM.Api/RFFM.Api.csproj --startup-project Back/ExtractionApi/src/RFFM.Host/RFFM.Host.csproj
```

Advertencias y buenas prácticas
- Haz commit o copia de seguridad de los archivos de migración antes de borrarlos.  
- No elimines migraciones aplicadas en producción sin respaldo y plan de rollback.  
- Si borras migraciones manualmente también puede ser necesario ajustar el `ModelSnapshot`.  
- Si tienes dudas, primero trabaja en una copia local de la base de datos o en un entorno de pruebas.
