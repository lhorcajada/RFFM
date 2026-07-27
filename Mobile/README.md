# FutbolBase Mobile

App React Native (Expo) para jugadores y familiares: calendario de eventos, convocatorias y confirmación de asistencia. Consume la misma API que `Back/ExtractionApi`.

## Requisitos

- Node.js y npm instalados.
- Un móvil (Android o iPhone) con la app **Expo Go** instalada (Play Store / App Store), **actualizada a la última versión**.
- El móvil y el PC conectados a la **misma red WiFi**.

> Expo Go solo soporta la última versión de SDK que publica Expo. Si al escanear el QR te dice que el proyecto es incompatible con tu Expo Go, actualiza la app desde la tienda o mira qué SDK usa este proyecto en `package.json` (`"expo": "..."`) y ajusta según corresponda.

## 1. Arranca el backend accesible desde tu red local

Por defecto, en desarrollo la API solo escucha en `localhost`, así que tu móvil no podrá llegar a ella. Arráncala escuchando en todas las interfaces, usando el puerto **HTTP** (no HTTPS, para evitar el certificado autofirmado que Expo Go no acepta):

```powershell
cd Back\ExtractionApi
dotnet run --project src\RFFM.Host --launch-profile https --urls "http://0.0.0.0:5170"
```

(el perfil `https` también abre el puerto HTTP 5170 en paralelo; usamos ese).

## 2. Averigua la IP de tu PC en la red WiFi

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi' } | Select-Object IPAddress
```

Apunta esa IP (ejemplo: `192.168.1.17`).

## 3. Arranca la app móvil apuntando a esa IP

```powershell
cd Mobile
$env:API_BASE_URL = "http://<TU_IP>:5170"
npx expo start
```

En Bash/macOS/Linux sería:

```bash
cd Mobile
API_BASE_URL=http://<TU_IP>:5170 npx expo start
```

## 4. Escanea el QR con tu móvil

- **Android**: abre Expo Go → "Scan QR code".
- **iPhone**: abre la cámara nativa → apunta al QR → toca la notificación (abre Expo Go automáticamente).

La app se compila y carga en tu móvil en unos segundos.

## Firewall de Windows

En la primera ejecución, Windows puede pedir permiso para "dotnet" o "node" en la red — acepta para redes privadas, si no tu móvil no podrá conectar con el backend.

## Tests

```bash
npm test
```

## Notas

- El login usa JWT directo (usuario/contraseña) contra `POST /api/mobile/login`, sin el flujo de temp-token que usa el frontend web.
- El usuario debe tener rol `Player` o `FamilyMember` y estar vinculado a al menos un equipo (`UserTeam`) para ver contenido.
- Variable `API_BASE_URL`: si no se define, usa `https://localhost:7287` por defecto (solo válido para emulador/simulador en el mismo PC, no para un móvil físico).
