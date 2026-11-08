<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/brand/vector-logo-dark.png">
    <img src="./public/brand/vector-logo-light.png" alt="Protoform Vector" width="420">
  </picture>
</p>

# Vector UI

The web interface for **Vector**, Protoform's fleet management platform built on
[openBalena](https://github.com/balena-io/open-balena). It is a static single-page app (React, react-admin, Tailwind):
build it once and host the files anywhere, for example on Vercel.

It is based on [open-balena-admin](https://github.com/ob-community/open-balena-admin) (MIT). Credit to Francois
Zaninotto, Marmelab and Raphael Scheible; the original license is kept in [LICENSE](LICENSE).

## What it needs

The UI holds no secrets and no server code. It talks to two backends:

| Backend | What for | Where it lives |
| ------- | -------- | -------------- |
| **openBalena API** | Fleets, devices, releases, environment variables | [openBalena](https://github.com/balena-io/open-balena), set in `REACT_APP_OPEN_BALENA_API_URL` |
| **Vector server** | Admin database with roles, image maker, terminals and file transfer, OS updates, delta records | [vector-balena](https://github.com/adhithyananilkumar/vector-balena) (`src/vector-server`), set in `REACT_APP_VECTOR_SERVER_URL` |

See [docs/architecture.md](docs/architecture.md) for how the pieces connect.

## Quick start

Requires Node.js 22 or newer and a running Vector backend (see the
[backend docs](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/vector-server.md)).

```sh
npm install
cp .env.template .env      # set REACT_APP_OPEN_BALENA_API_URL and REACT_APP_OPEN_BALENA_API_VERSION
npm run dev                # http://localhost:3000
```

In development the dev server forwards the Vector server's routes to `VECTOR_SERVER_DEV_URL` (default
`http://127.0.0.1:3001`), so no CORS setup is needed.

## Build and deploy

```sh
npm run build              # static site in dist/client
npm run preview            # try it locally
```

On Vercel, import this repository and add the `REACT_APP_*` variables; `vercel.json` already sets the build command,
output folder and headers. Details for Vercel and other static hosts are in [docs/deploying.md](docs/deploying.md).

## Scripts

| Command | Purpose |
| ------- | ------- |
| `npm run dev` | Development server with hot reload (`dev:local` loads the `local` mode) |
| `npm run build` | Production build into `dist/client` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |

## Documentation

| Topic | Document |
| ----- | -------- |
| How the UI, the Vector server and openBalena fit together | [docs/architecture.md](docs/architecture.md) |
| Every UI setting | [docs/configuration.md](docs/configuration.md) |
| Deploying to Vercel or any static host | [docs/deploying.md](docs/deploying.md) |
| Working on the code, tests, dependency updates | [docs/development.md](docs/development.md) |
| Supported openBalena API versions | [docs/api-versions.md](docs/api-versions.md), [docs/compatibility.md](docs/compatibility.md) |
| Device dashboard, logs, terminals and file transfer | [docs/device-features.md](docs/device-features.md), [docs/device-refresh.md](docs/device-refresh.md) |
| Roles and access control (server side) | [backend: access-controls](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/access-controls.md) |
| Remote access design (server side) | [backend: remote-access](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/remote-access.md) |
| Host OS and Supervisor updates (server side) | [backend: os-and-supervisor-updates](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/os-and-supervisor-updates.md) |
| Everything about the backend | [backend docs index](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/README.md) |

The same user guides are available inside the app under **Docs**.

## Credits

- The [ra-data-postgrest](https://github.com/raphiniert-com/ra-data-postgrest) project was instrumental in establishing
  the link to the openBalena database.
