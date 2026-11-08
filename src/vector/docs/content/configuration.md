# Configuration reference

Vector has two parts, and each has its own settings:

- The **Vector UI** is a static website. Its settings start with `REACT_APP_` and are baked in when it is built (on Vercel: Project Settings > Environment Variables).
- The **Vector server** is the API behind it. Its settings are environment variables in `src/vector-server/.env`, or set in the compose file when it runs in Docker.

Rebuild the UI after changing a `REACT_APP_` value, and restart the server after changing its settings.

> [!WARNING]
> The server's `.env` contains secrets such as `OPEN_BALENA_JWT_SECRET` and the S3 keys. Never commit it to git and never share it. The UI holds no secrets; everything in it is visible in the browser.

## UI settings

| Variable | Example | Meaning |
|---|---|---|
| `REACT_APP_OPEN_BALENA_API_URL` | `https://api.mydomain.com` | Public URL of the openBalena API, used by the browser. |
| `REACT_APP_OPEN_BALENA_API_VERSION` | `v52.2.3` | API version the UI speaks. Must match your server. See below. |
| `REACT_APP_VECTOR_SERVER_URL` | `https://vector.mydomain.com` | Public URL of the Vector server. Leave empty only in local development. |
| `REACT_APP_OPEN_BALENA_ODATA_VERSION` | empty | Optional OData version. |
| `REACT_APP_BANNER_IMAGE` | URL | Optional custom login banner. |
| `REACT_APP_OPEN_BALENA_BUILT_IN_REMOTE_ENABLED` | `true` | Set `false` to hide the built-in terminal and file transfer. |

## Vector server settings

| Variable | Example | Meaning |
|---|---|---|
| `PORT` | `3001` | Port the server listens on. |
| `OPEN_BALENA_API_URL` | `https://api.mydomain.com` | openBalena API address, as the server reaches it. |
| `OPEN_BALENA_API_VERSION` | `v52.2.3` | API version, same as the UI's. |
| `VECTOR_ALLOWED_ORIGINS` | `https://vector-ui.vercel.app` | Where the UI is hosted. Only these sites may call the server from a browser. |
| `VECTOR_PUBLIC_URL` | `https://vector.mydomain.com` | Public URL of the server. |

## Security and access

| Variable | Meaning |
|---|---|
| `OPEN_BALENA_JWT_SECRET` | Secret used to verify sign-in tokens. Must equal the API's secret. |
| `OPEN_BALENA_POSTGREST_URL` | **Internal** PostgREST address. Never expose it to browsers. |
| `OPEN_BALENA_BOOTSTRAP_USER_ID` | Numeric user ID to make the first `global-admin`. See [Access control](doc:access-control). |
| `OPEN_BALENA_ORGANIZATION_ADMIN_ASSIGNABLE_ROLES` | Roles an organization admin may assign, comma-separated. |

## Storage (S3)

Vector stores registry data and OS metadata in an S3-compatible service (SeaweedFS, MinIO or AWS S3).

| Variable | Meaning |
|---|---|
| `OPEN_BALENA_S3_URL` | S3 endpoint, path-style, for example `https://s3.mydomain.com`. |
| `OPEN_BALENA_S3_ACCESS_KEY` / `OPEN_BALENA_S3_SECRET_KEY` | Credentials. |
| `OPEN_BALENA_S3_REGISTRY_BUCKET` | Registry bucket, for example `registry-data`. |
| `OPEN_BALENA_S3_REGION` | Region, for example `us-east-1`. |
| `OPEN_BALENA_OS_METADATA_BUCKET` | Private bucket for device-type metadata, for example `balena-os-metadata`. |
| `OPEN_BALENA_OS_METADATA_URL` | Server address the API can reach. Defaults to `VECTOR_PUBLIC_URL`. |
| `OPEN_BALENA_OS_METADATA_SOURCE_URL` | Where metadata is fetched from during a manual sync. |
| `CONTRACT_ALLOWLIST` | Same as the API's list. Empty allows all local device types. |

## Remote access

See [Remote access](doc:remote-access) for what each setting does.

| Variable | Default |
|---|---|
| `REACT_APP_OPEN_BALENA_REMOTE_URL` | empty selects built-in mode |
| `OPEN_BALENA_TUNNEL_URL` | empty (built-in remote access off) |
| `OPEN_BALENA_SSH_TARGET_PORT` | `22222` |
| `OPEN_BALENA_REMOTE_CONNECT_TIMEOUT_MS` | `15000` |
| `OPEN_BALENA_SSH_KEY_IDLE_TTL_MS` | `600000` |
| `OPEN_BALENA_SSH_HOST_KEYS` | empty |
| `OPEN_BALENA_SSH_ALLOW_UNVERIFIED_HOST_KEYS` | `false` |
| `OPEN_BALENA_SSH_TRUST_ON_FIRST_USE` | `false` (on in development) |
| `OPEN_BALENA_REMOTE_PUBLIC_ORIGIN` | empty |
| `OPEN_BALENA_REMOTE_TRUSTED_PROXIES` | empty |
| `OPEN_BALENA_REMOTE_ALLOWED_ORIGINS` | empty |
| `OPEN_BALENA_REMOTE_TICKET_TTL_MS` | `30000` |
| `OPEN_BALENA_REMOTE_MAX_PENDING_TICKETS_PER_USER` | `8` |
| `OPEN_BALENA_REMOTE_MAX_PENDING_TICKETS` | `1024` |
| `OPEN_BALENA_REMOTE_MAX_OPERATIONS_PER_USER` | `8` |
| `OPEN_BALENA_REMOTE_MAX_WEBSOCKETS_PER_IP` | `8` |
| `OPEN_BALENA_REMOTE_MAX_CHANNELS_PER_SOCKET` | `4` |
| `OPEN_BALENA_REMOTE_MAX_MESSAGE_BYTES` | `1048576` |
| `OPEN_BALENA_REMOTE_MAX_UPLOAD_BYTES` | `1073741824` |
| `OPEN_BALENA_REMOTE_MAX_PATH_BYTES` | `4096` |

## Base image library

| Variable | Default | Meaning |
|---|---|---|
| `VECTOR_BASE_IMAGES_DIR` | `./data/base-images` | Where downloaded balenaOS images are stored. |
| `VECTOR_OS_CATALOG_API_URL` | `https://api.balena-cloud.com` | Where versions are listed and images are downloaded. |

See [Base images](doc:base-images).

## Matching the API version

`REACT_APP_OPEN_BALENA_API_VERSION` (and `OPEN_BALENA_API_VERSION` on the server) tells Vector which fields and tables the API has. If it is wrong, pages may show errors or missing columns. To find your server's version, look at the API container's image tag or its release notes:

```bash
docker compose images api
```

Vector tracks versions in its compatibility table and falls back safely for features introduced later.

## Run commands

UI (this repository):

| Command | Purpose |
|---|---|
| `npm run dev` | Development server with hot reload. Forwards server routes to `VECTOR_SERVER_DEV_URL`. |
| `npm run build` | Build the static site into `dist/client`. |
| `npm run preview` | Serve the built site locally. |
| `npm run typecheck` | Check TypeScript. |
| `npm test` | Run the tests. |

Vector server (`src/vector-server` in the backend repository):

| Command | Purpose |
|---|---|
| `npm run dev` | Run with reload, reading `.env`. |
| `npm run build` | Bundle into `dist/index.js`. |
| `npm start` | Run the bundle. |
| `npm test` | Run the tests. |

Node.js **22 or newer** builds the UI; the server needs **24 or newer**.

## Deploy the UI

The UI is plain static files, so it can be hosted anywhere. On Vercel, import the repository, set the UI settings above as environment variables, and deploy; the repository already contains the build settings. For any other host:

```bash
npm ci
npm run build
```

Upload `dist/client` to the host. Use HTTPS for both the UI and the Vector server: browsers block a secure page from calling an insecure server.

## Deploy the Vector server

It runs as a container in the openBalena stack, next to the API, and needs no manual setup:

```bash
docker compose up -d vector-server
```

Downloaded base images are kept in the `vector-data` volume, so they survive container replacement. Put it behind HTTPS (for example a route on the stack's HAProxy) before pointing a hosted UI at it.
