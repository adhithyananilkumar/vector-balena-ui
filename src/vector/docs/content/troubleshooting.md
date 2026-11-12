# Troubleshooting

Find your symptom, check the cause, apply the fix. When you ask for help, include the **exact error text**, the command you ran, and the CLI version from `balena version`.

## First checks

Run these before anything else. They answer most questions.

```bash
balena version
balena whoami
docker version
curl https://api.mydomain.com/ping
nslookup registry2.mydomain.com
```

```powershell
balena version
balena whoami
docker version
Invoke-WebRequest https://api.mydomain.com/ping
Test-NetConnection registry2.mydomain.com -Port 443
```

For more detail from the CLI set `DEBUG=1`, or add `--debug` to a command.

## CLI and login problems

### CLI talks to balena-cloud.com

`balena whoami` shows `balena-cloud.com`, or login asks for a balenaCloud account.

**Fix:** set the server URL (see [Connect the CLI to Vector](doc:connect-cli)):

```powershell
$env:BALENARC_BALENA_URL = "mydomain.com"
```

### `unable to verify the first certificate`, `self signed certificate` or `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`

The CLI does not trust your server's certificate authority.

**Fix:** point `NODE_EXTRA_CA_CERTS` at the CA file and open a **new** terminal.

```bash
export NODE_EXTRA_CA_CERTS=/path/to/ca.pem
```

```powershell
setx NODE_EXTRA_CA_CERTS "C:\path\to\ca.pem"
```

Make sure the path exists and that the file is the `.pem` from `.balena/ca-mydomain.com.pem` on the server.

### The UI on Vercel shows a setup screen or `Failed to fetch`

The UI reads its settings when it is built. Check, in this order:

1. The three `REACT_APP_*` variables exist on the Vercel project (Production) and the site was **redeployed** after adding them.
2. `curl https://api.mydomain.com/ping` and `curl https://vector.mydomain.com/healthz` work from your computer, with no certificate warning. A page served over HTTPS cannot call a server with an untrusted certificate; use a Let's Encrypt certificate (see [Certificates and DNS](doc:certificates-dns)).
3. `VECTOR_ALLOWED_ORIGINS` on the server contains the UI's exact origin (for example `https://admin.mydomain.com`, no trailing slash). Restart the server after changing it.
4. The API answers browsers: `curl` is exempt from the API's CORS headers, so test with `curl -A Mozilla/5.0 -H "Origin: https://admin.mydomain.com" -X OPTIONS https://api.mydomain.com/v7/application -i` and look for `access-control-allow-origin`.

### After signing in: `502` on `/admin-db/actions/access-context`, or "Unable to resolve administrator access from role"

Two first-start causes, both on the server:

1. **PostgREST started before the API had created the database tables.** `docker compose logs postgrest` then says `Schema cache loaded 0 Relations`. Restart it once the API is healthy: `docker compose restart postgrest` (the log should now show about 54 relations).
2. **No administrator exists yet.** Find your user's numeric ID (`docker compose exec db psql -U docker -d resin -Atc 'select id, email from "user"'`), set `OPEN_BALENA_BOOTSTRAP_USER_ID=<id>` in the stack's `.env` and run `docker compose up -d vector-server`. Startup creates the `global-admin` role and assigns it. See [Access control](doc:access-control).

### `getaddrinfo ENOTFOUND api.mydomain.com`

Your computer cannot resolve the name.

**Fix:** check DNS with `nslookup api.mydomain.com`. On a private network create the records on your own DNS server. See [Certificates and DNS](doc:certificates-dns).

### `ETIMEDOUT` or `ECONNREFUSED`

You can resolve the name but cannot reach the server on port 443.

**Fix:** check that the server is running (`docker compose ps` on the server), that the firewall allows 443, and that you are on the right network or VPN.

### Login fails with `Invalid credentials`

- Use the `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD` printed by `make up`, or an account created in the UI.
- Make sure you are on the right server (`balena whoami`).
- If you forgot the password, an administrator can reset it from **Users** in the UI.

### `Not logged in` or token expired

**Fix:** run `balena login` again. For CI, create a new API key and use `balena login --token`.

## Deploy and build problems

### `x509: certificate signed by unknown authority` when pushing

The build works but the push fails. Docker, not the CLI, does not trust your CA.

**Fix:** add the CA to the system and restart Docker. On Windows, in an administrator PowerShell:

```powershell
certutil -addstore -f "ROOT" C:\path\to\ca.pem
Restart-Service docker
```

On Docker Desktop, restart it from the tray icon. Other systems: [Self-signed certificates](doc:connect-cli#self-signed-certificates).

### `Cannot connect to the Docker daemon` or `docker: command not found`

Docker is not running.

**Fix:** start Docker Desktop (or `sudo systemctl start docker`) and wait until `docker version` shows both **Client** and **Server**. On Linux make sure your user is in the `docker` group.

### The push hangs or fails halfway: `unauthorized`, `EOF`, `connection reset`

- Your login expired. Run `balena login`.
- `registry2.mydomain.com` is not reachable from your computer. Test with `Test-NetConnection registry2.mydomain.com -Port 443`.
- A proxy or antivirus is breaking large uploads. Try a different network.
- The server's disk is full. Check the S3 volume (`df -h` on the server).

### `Fleet not found` or `Application not found`

The name or slug is wrong, or you are logged in to the wrong server.

**Fix:** list fleets with `balena fleet list` and copy the exact name or slug (for example `admin/myfleet`).

### `Dockerfile not found` or nothing to build

Run the command from the project folder, or pass `--source <folder>`. Make sure the file is named `Dockerfile`, `Dockerfile.template` or `docker-compose.yml`.

### `exec format error` on the device

The image was built for the wrong CPU. Your PC is amd64, the device is ARM.

**Fix:** deploy with `--emulated`, or use buildx. See [Multi-architecture builds](doc:multi-arch).

### Build fails with `no space left on device`

Docker ran out of disk.

**Fix:** clear unused data, then retry:

```bash
docker system prune -a
```

On Docker Desktop you can also enlarge the disk image under **Settings**, then **Resources**.

### The build is very slow

- `--emulated` is slow by design. Use prebuilt packages and cache layers (copy dependency files before source).
- Use `.dockerignore` to avoid sending `node_modules` and `.git` into the build.
- Build on a machine with the same CPU as the devices.

### The deploy succeeded but devices did not update

- Is the release a **draft**? Run `balena release finalize <id>`.
- Is the device or the fleet **pinned**? See [Releases and rollouts](doc:releases-rollouts).
- Is the device online? Check **Devices** in the UI.
- Is the device in the fleet you deployed to?

## Device does not come online

### The device never appears in the UI

1. **Power and boot:** a Raspberry Pi shows a steady or blinking activity LED after boot.
2. **Network:** for Ethernet, check the link lights; for Wi-Fi, check the SSID and password in the image.
3. **DNS:** the device must be able to resolve `api.mydomain.com`. See [Certificates and DNS](doc:certificates-dns).
4. **Port 443** must be open from the device to the server.
5. **Certificate:** with a self-signed server the config needs `balenaRootCA`. Rebuild the image with **Add device**.
6. **Time:** a wrong clock breaks TLS. Allow NTP.

### The device appears but stays offline

- The VPN service cannot be reached. Check `cloudlink.mydomain.com` resolves and port 443 is open.
- On the server, check the VPN logs: `docker compose logs -f vpn`.
- The device was reflashed with a config used by another device. Each device needs its own identity (see [Add and flash a device](doc:add-device)).

### Lookups fail now and then on a private network

Public fallback DNS (`8.8.8.8`) is answering "no such name". Set your own resolver in `config.json` (`"dnsServers"`), or use a public domain. See [Certificates and DNS](doc:certificates-dns).

### The device is online but the app does not run

Open the device and read **Services** and **Logs**.

| What you see | Meaning |
|---|---|
| Stuck at *Downloading* | The device cannot reach `registry2`, or storage is full. |
| *Running* then restarts again and again | Your container crashes. Read its logs. |
| Nothing listed | The fleet has no finalized release, or the device is pinned to an old one. |

## Remote access does not connect

| Symptom | Cause and fix |
|---|---|
| The Connect button is missing or disabled | The device is offline, or remote access is not configured. Set `OPEN_BALENA_TUNNEL_URL` (built-in mode). |
| `Origin not allowed` or the socket closes at once | Behind a reverse proxy, set `OPEN_BALENA_REMOTE_PUBLIC_ORIGIN` to the browser address. |
| `429 Too many requests` | You hit a limit. Close terminals, wait, or raise `OPEN_BALENA_REMOTE_MAX_OPERATIONS_PER_USER`. |
| Many users behind one office address are refused | Raise `OPEN_BALENA_REMOTE_MAX_WEBSOCKETS_PER_IP`. |
| Timeout | The device is slow to answer. Raise `OPEN_BALENA_REMOTE_CONNECT_TIMEOUT_MS`. |
| Host key mismatch | The device was reflashed. Update the pin in `OPEN_BALENA_SSH_HOST_KEYS`. |
| Upload is rejected | The file exceeds `OPEN_BALENA_REMOTE_MAX_UPLOAD_BYTES` (1 GiB default). |
| Download says "No such file" after the save dialog | The path does not exist. Use an absolute path inside the chosen filesystem. |

See [Remote access](doc:remote-access).

## Access and permission errors

### Everything shows a 401 or sends you back to the login page

Your token expired, or `OPEN_BALENA_JWT_SECRET` on the Vector server does not equal the API's secret. Sign in again; if it persists, compare the secrets.

### 403 Forbidden on a page

You do not have access to that resource. Ask an administrator for the right role. Some pages (Roles, Permissions, Configs) are for global administrators only.

### Everyone is an administrator

No `global-admin` role exists yet, so Vector is in legacy mode. See [Legacy mode and how to leave it](doc:access-control#legacy-mode-and-how-to-leave-it).

### I locked myself out

Set `OPEN_BALENA_BOOTSTRAP_USER_ID` to your numeric user id and restart the UI. Startup repairs the `global-admin` role and your assignment.

## Add device

### The OS version list is empty

The Vector server cannot reach the catalog. Check outbound internet and `VECTOR_OS_CATALOG_API_URL`.

### The image download stops or says the link expired

The download link is valid for 10 minutes, and the prepared image can be downloaded again for 30. Press **Download the image again**; a device registered for a **This device only** image is not registered a second time. If the answers on the page change, the image is prepared again.

### The image failed its check, or the saved file is flagged

The server compares the image with the checksum in balena's download and stops before the last part if they differ. The page also reads the saved file back. In either case do not flash that file: press **Try again**, which streams a fresh copy. If it keeps failing, check the connection between the Vector server and the internet.

### The download stalls and fails after a minute

The server gives up when balena sends nothing for 60 seconds, and the page shows the error. Press **Try again**.

### "Other images are being downloaded right now"

The server streams at most two images at a time (`VECTOR_IMAGE_MAX_STREAMS`). Try again in a minute.

### The page has no folder choice

Choosing a folder needs Chrome, Edge or another Chromium browser. In other browsers the image goes to the browser's downloads folder.

### "The balenaOS download service answered HTTP 404"

That device type and version do not exist in balena's download service. Pick another version.

### Etcher does not list my SD card

Run Etcher as administrator, try another reader or card, and check the card is not write-protected.

## The UI itself

### Blank page or errors after an upgrade

Hard-reload the browser (`Ctrl Shift R`). If you changed a `REACT_APP_` variable, rebuild with `npm run build`; those values are built into the page.

### Pages show missing columns or API errors

`REACT_APP_OPEN_BALENA_API_VERSION` does not match your server. See [Configuration reference](doc:configuration).

### The Vector server cannot start

Node.js must be version 24 or newer when running it outside Docker (`node --version`). Check the console output for the missing variable. `OPEN_BALENA_JWT_SECRET` and the S3 settings are required.

### Port already in use

Change `PORT` in `.env`, or stop the other program using it.

## Server problems

| Symptom | Check |
|---|---|
| Nothing responds | `docker compose ps` on the server. Start with `make up`. |
| One service keeps restarting | `docker compose logs -f <service>`, for example `api`, `registry` or `db`. |
| Certificates expired | Run `make auto-pki` (or renew your own certificate) and then `make verify`. |
| Disk full | `df -h`. Clean old images and releases, enlarge the S3 volume. |
| Slow or timing out | Needs at least 2 GB of memory. Check `free -h` and `docker stats`. |

## Still stuck?

Collect this, then ask your administrator or the Vector maintainers:

```bash
balena version
balena whoami
docker version
DEBUG=1 balena deploy MyFleet --build
```

and the output of `docker compose logs --tail 200 api registry vpn` from the server.
