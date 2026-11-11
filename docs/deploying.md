# Deploying the UI

The build output is plain static files in `dist/client`. Any static host works; Vercel is set up out of the box.

Before deploying, have these ready:

1. A reachable **openBalena API** that allows your UI's origin (CORS).
2. A running **Vector server** with HTTPS, and your UI's origin in its `VECTOR_ALLOWED_ORIGINS`. The backend stack
   serves it at `https://vector.<your domain>` with the same trusted certificate as the API, so nothing extra needs
   to be installed. See the
   [backend guide](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/vector-server.md#public-https-address).

## Vercel

1. Import the `vector-balena-ui` repository as a new project. Vercel detects Vite; `vercel.json` already sets:
   - install command `npm ci` and build command `npm run build`
   - output directory `dist/client`
   - security headers, long caching for `/assets`, no caching for `/env.js`
   - a fallback to `index.html` for paths without a file extension
2. Under Environment Variables add (for Production and Preview):

   | Name | Value |
   | ---- | ----- |
   | `REACT_APP_OPEN_BALENA_API_URL` | `https://api.example.com` |
   | `REACT_APP_OPEN_BALENA_API_VERSION` | `v52.2.3` |
   | `REACT_APP_VECTOR_SERVER_URL` | `https://vector.example.com` |

   These are not secrets (they end up in the browser bundle), so use plain variables rather than sensitive ones.
   The values are read **at build time**: after adding or changing them, redeploy (Deployments > the latest
   production deployment > Redeploy). Vercel may ask you to verify your identity by email before it redeploys.

3. Deploy. Then take the deployment's origin (for example `https://vector-ui.vercel.app`) and add it to the server's
   `VECTOR_ALLOWED_ORIGINS`, and to the API's CORS settings. Preview deployments get their own origin; add them while
   testing, or use a fixed custom domain.
4. Sign in. If sign-in fails with "Failed to fetch", the browser blocked the request: check HTTPS on the API, CORS, and
   that the API's certificate is trusted by the browser. A self-signed stack certificate has to be trusted on every
   machine that opens the UI.

The app uses hash-based routing (`/#/devices`), so deep links work on any static host without server rewrites.

## Other static hosts

```sh
npm ci
npm run build
```

Upload `dist/client` (nginx, Caddy, S3 with a CDN, GitHub Pages, ...). Serve `env.js` with `Cache-Control: no-cache` if
you plan to edit it. Always use HTTPS: a page served over HTTPS cannot call an HTTP server.

A container is not provided because there is nothing to run. If you want one, any web server image with
`dist/client` copied in works, for example `nginx:alpine`.

## Same origin through a reverse proxy

If you prefer one address, leave `REACT_APP_VECTOR_SERVER_URL` empty and have the proxy send these paths to the Vector
server: `/admin-db`, `/balena-os`, `/deleteRegistryImage`, `/deleteOrphanedRegistryImages`, `/deltas`,
`/device-supervisor-target`, `/device-update-options`, `/image-maker` and `/remote` (with WebSocket upgrade). Everything
else is served from the static files. No CORS settings are needed in that setup.

## Checklist

- [ ] UI origin is in the server's `VECTOR_ALLOWED_ORIGINS`
- [ ] Server and API are on HTTPS with certificates the browser trusts
- [ ] `OPEN_BALENA_BOOTSTRAP_USER_ID` was used once on the server so roles are enforced (see
      [access controls](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/access-controls.md))
- [ ] No secret is set in a `REACT_APP_*` variable
