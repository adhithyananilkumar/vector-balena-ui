# Architecture

The UI is a static single-page app. Everything it shows comes from two HTTP backends; it has no server of its own.

```
                    ┌──────────────────────────────┐
                    │   Vector UI (static files)   │  Vercel, nginx, S3 + CDN ...
                    └───────┬───────────────┬──────┘
         OData (fleets,     │               │  REST + WebSocket (bearer token)
         devices, releases) │               │
                            ▼               ▼
              ┌──────────────────┐   ┌──────────────────┐
              │  openBalena API  │   │  Vector server   │ ── PostgREST (admin database)
              └──────────────────┘   │ (vector-balena   │ ── S3 / registry
                                     │  repo)           │ ── VPN tunnel to devices
                                     └──────────────────┘ ── delta server
```

## Who does what

| Concern | Handled by |
| ------- | ---------- |
| Sign in | The UI posts to the openBalena API's `/login_` and keeps the token in `localStorage`. |
| Fleets, devices, releases, variables, tags | The UI calls the openBalena API directly with the bearer token (OData). |
| Users, roles, API keys, organizations, anything that needs the admin database | Vector server `/admin-db/*`. It checks roles and organization scope on every request. |
| Terminals and file transfer | Vector server `/remote/*`. The browser opens a WebSocket with a single-use ticket; the server opens SSH through the openBalena VPN. |
| Making a device image, downloading balenaOS | Vector server `/image-maker/*`. |
| Host OS and Supervisor updates | Vector server `/balena-os/*`, `/device-update-options`, `/device-supervisor-target`. |
| Delta build records | Vector server `/deltas/records`. |

The UI never sees database credentials, S3 keys, SSH keys or the JWT signing secret; those exist only on the server.

## How requests find the server

All server calls go through one helper, [`src/lib/serverUrl.ts`](../src/lib/serverUrl.ts):

- `REACT_APP_VECTOR_SERVER_URL` set: requests go to that address (cross-origin, so the server must list the UI's origin
  in `VECTOR_ALLOWED_ORIGINS`). WebSockets use the same host with `ws://` or `wss://`.
- Empty: requests go to the page's own origin. In development Vite forwards them to `VECTOR_SERVER_DEV_URL`; in
  production this form needs a reverse proxy that routes those paths to the server.

The openBalena API is reached at `REACT_APP_OPEN_BALENA_API_URL` and must allow the UI's origin itself.

## Configuration at build and run time

Settings are read in this order: `window.__OBUI_ENV__` (set by `public/env.js`, replaceable on a static host without
rebuilding), then the values baked into the build. See [configuration.md](configuration.md).

## Code that exists in both repositories

A few small modules are needed by both the browser and the server: the API compatibility table (`src/versions`),
password policy and hashing (`src/lib/password*.ts`), permission-hint messages (`src/lib/httpErrorMessage.ts`) and remote
target parsing (`src/lib/remoteTarget.ts`). The backend keeps copies under
[`src/vector-server/src/shared`](https://github.com/adhithyananilkumar/vector-balena/tree/master/src/vector-server/src/shared).
Change both when you change one.

## Source layout

```
src/
├── App.tsx               routes and resources
├── authProvider/         sign in, session, role context
├── dataProvider/         OData and Vector server data access
├── components/           react-admin resource screens (fleets, devices, releases ...)
├── dashboards/device/    device dashboard widgets
├── ui/                   shared pieces (terminal, file transfer, logs, theme)
├── lib/                  helpers (server URL, env, remote access protocol)
├── versions/             API compatibility table
└── vector/               Vector shell: layout, pages (Add device, Base images, Delta builds), in-app docs
public/                   static assets, device-type logos, env.js
vercel.json               Vercel build and headers
```
