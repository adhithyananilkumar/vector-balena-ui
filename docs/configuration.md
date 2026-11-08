# Configuration

The UI is configured with `REACT_APP_*` variables. They are read **at build time** and baked into the JavaScript, so
they are visible to anyone who opens the site: never put a secret in them. Server-side settings (database, S3, JWT
secret, SSH) belong to the Vector server; see its
[configuration reference](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/vector-server-configuration.md).

Where to set them:

- Local development: a `.env` file next to `package.json` (copy `.env.template`).
- Vercel: Project Settings > Environment Variables. Redeploy after changing one.
- Any other build: environment variables when running `npm run build`.

## Required

| Variable | Example | Meaning |
| -------- | ------- | ------- |
| `REACT_APP_OPEN_BALENA_API_URL` | `https://api.example.com` | openBalena API the browser calls. It must allow this UI's origin (CORS). |
| `REACT_APP_OPEN_BALENA_API_VERSION` | `v52.2.3` | Version of that API. Selects compatible resource and field names. See [api-versions.md](api-versions.md). |

## Vector server

| Variable | Example | Meaning |
| -------- | ------- | ------- |
| `REACT_APP_VECTOR_SERVER_URL` | `https://vector.example.com` | Public address of the Vector server. Use HTTPS when the UI is served over HTTPS. Leave empty in development, where `npm run dev` forwards requests, or when a reverse proxy serves both from one origin. |
| `VECTOR_SERVER_DEV_URL` | `http://127.0.0.1:3001` | Development only: where `npm run dev` forwards server routes. Not part of the build. |

The server must list the UI's origin in its `VECTOR_ALLOWED_ORIGINS`.

## Optional

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `REACT_APP_OPEN_BALENA_ODATA_VERSION` | derived | `v6` or `v7`. Normally omit it. |
| `REACT_APP_BANNER_IMAGE` | none | URL of a custom banner on the sign-in page. |
| `REACT_APP_OPEN_BALENA_BUILT_IN_REMOTE_ENABLED` | `true` | Set `false` to hide the built-in terminal and file transfer. |
| `REACT_APP_OPEN_BALENA_REMOTE_URL` | empty | URL of a legacy [open-balena-remote](https://github.com/ob-community/open-balena-remote) instance. When set, device Connect windows use that instead of the built-in terminal. |
| `PORT` | `3000` | Development server port. |

## Changing settings without rebuilding

Static hosts without a build step can replace `env.js` in the site root. It runs before the app and takes precedence
over the baked-in values:

```js
window.__OBUI_ENV__ = {
  REACT_APP_VECTOR_SERVER_URL: 'https://vector.example.com',
  REACT_APP_OPEN_BALENA_API_URL: 'https://api.example.com',
  REACT_APP_OPEN_BALENA_API_VERSION: 'v52.2.3',
};
```

An empty string for `REACT_APP_OPEN_BALENA_REMOTE_URL` overrides a legacy URL baked into the build.
