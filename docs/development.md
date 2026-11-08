# Development

## Setup

Node.js 22 or newer.

```sh
npm install
cp .env.template .env
npm run dev                # Vite on http://localhost:3000
```

Run the [Vector server](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/vector-server.md) too
(`docker compose up -d vector-server` in the backend repository, or `npm run dev` in `src/vector-server`). The dev server
forwards the server's routes to `VECTOR_SERVER_DEV_URL`; the API is called directly at
`REACT_APP_OPEN_BALENA_API_URL`.

Modes: `npm run dev` uses the `devprod` mode (hosted-like settings), `npm run dev:local` the `local` mode. Vite loads
`.env`, `.env.local` and `.env.<mode>`.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

CI ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) runs the same three. Tests use Node's built-in runner
through `tsx`; they sit next to the code as `*.test.ts`, and `test/` holds tests for the data provider.

## Calling the server from new code

Never hard-code a server path or origin. Use [`serverUrl()`](../src/lib/serverUrl.ts) (or `authFetch` in
`src/vector/lib/api.ts`, which uses it) so the page works both against a proxy and against a separately hosted server.
Requests made through the react-admin `httpClient` get this automatically for root-relative URLs.

Code that is also needed by the server (`src/versions`, `src/lib/password*.ts`, `src/lib/httpErrorMessage.ts`,
`src/lib/remoteTarget.ts`) is copied in the backend's
[`shared`](https://github.com/adhithyananilkumar/vector-balena/tree/master/src/vector-server/src/shared) folder. Update
both copies together.

## Updating dependencies

After dependency updates, include the regenerated `package-lock.json` and validate the locked install before opening a
PR:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm audit
```

Keep `react-admin` and `ra-core` on the same version, and keep `react-router` and `react-router-dom` aligned.

## Device type catalogue

`scripts/sync-device-types.cjs` regenerates the board names and logos in `public/device-types` and
`src/vector/data/deviceTypes.json` from balena's public contracts repository. The header of the script has the commands.
