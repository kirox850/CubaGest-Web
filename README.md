# CubaGest — App móvil (Expo / React Native)

App instalable para celular que consume la misma API del backend de
`cubagest-backend`. Reproduce los módulos del sistema web (Dashboard,
Inventario, POS, Facturación, Contabilidad, Usuarios) mostrando solo las
pestañas permitidas según el rol del usuario que inició sesión.

## 1. Requisitos

- Tener Node.js instalado en tu computadora (nodejs.org, versión LTS).
- Instalar la app **Expo Go** en tu celular (gratis, en Play Store / App Store).
- El backend (`cubagest-backend`) corriendo y accesible desde tu celular.

## 2. Configurar la URL de la API

Abre `src/api/config.js` y cambia `API_BASE_URL`:

- Si estás probando en tu misma red WiFi (computadora + celular conectados
  al mismo WiFi de casa/negocio), usa la IP local de tu computadora, por
  ejemplo `http://192.168.1.50:4000/api` (busca tu IP con `ipconfig` en
  Windows o `ifconfig`/`ipconfig getifaddr en0` en Mac).
- Si ya desplegaste el backend en Railway/Cloudflare, usa esa URL directa,
  ej. `https://api.tunegocio.com/api`.

**Nunca uses `localhost`** — el celular no tiene idea de qué computadora
es "localhost", eso solo funciona dentro de la misma máquina.

## 3. Instalar y correr

```bash
cd cubagest-mobile
npm install
npm start
```

Esto abre una pantalla en la terminal con un código QR.

## 4. Probar en tu celular

1. Abre la app **Expo Go** en tu celular.
2. Escanea el código QR que aparece en la terminal (en Android, desde la
   propia app Expo Go; en iPhone, desde la cámara nativa).
3. La app CubaGest se carga en tu celular. Usa las mismas credenciales
   de prueba del backend:
   - `admin@cubagest.cu` / `Admin123`
   - `cajero@cubagest.cu` / `Cajero123`
   - `contadora@cubagest.cu` / `Conta123`

Cada vez que yo te dé cambios de código, guardas los archivos y la app
se recarga sola en el celular (no hace falta escanear de nuevo, mientras
`npm start` siga corriendo).

## 5. Publicar más adelante (cuando estés listo)

Cuando quieras instalarla "de verdad" (sin depender de Expo Go) o subirla
a las tiendas, se usa **EAS Build** (`npx eas-cli build`), que genera un
`.apk`/`.aab` para Android o un `.ipa` para iOS sin necesitar Mac ni
Android Studio. Esto lo vemos cuando decidas dar ese paso.
