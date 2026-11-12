# Deploy from your computer

This is the main workflow: **build on your own machine, push to Vector, and let the server distribute to devices.** No build server is required.

## How it works

`balena deploy` does everything in one command:

1. Reads your project (a `docker-compose.yml`, or a `Dockerfile`).
2. Builds the images with your local Docker.
3. Pushes them to `registry2.mydomain.com`.
4. Creates a **release** in the fleet you named.
5. Devices in that fleet then download the release and update themselves.

> [!NOTE]
> The command `balena push` is different. It uploads your source code to a remote builder, and Vector does not include one. Always use `balena deploy` (or `balena build` followed by a push) with Vector.

## Before you start

- [Docker and the CLI are installed](doc:install-cli) and Docker is running.
- [The CLI is connected](doc:connect-cli) to your server and you are logged in.
- A fleet exists, and its device type matches your devices.

## 1. Make a project

Create a folder with a `Dockerfile.template`. The `%%BALENA_MACHINE_NAME%%` placeholder is filled in with the right base image for the fleet's device type:

```dockerfile
FROM balenalib/%%BALENA_MACHINE_NAME%%-alpine

CMD [ "balena-idle" ]
```

For several containers use a `docker-compose.yml`:

```yaml
version: '2.1'
services:
  web:
    build: ./web
    ports:
      - '80:80'
    restart: always
  worker:
    build: ./worker
    restart: always
```

## 2. Deploy

From the project folder:

```bash
balena deploy MyFleet --build
```

`--build` forces a fresh build. Without it, the CLI reuses cached layers where nothing changed.

A successful run ends with:

```text
[Info]    Creating release...
[Info]    Pushing images to registry...
[Info]    Saving release...
[Success] Deploy succeeded!
[Success] Release: 50be7bdb0ea6819c91a5dd7bcd7635ad
```

The release hash at the end identifies this version everywhere in Vector.

> [!TIP]
> If the folder sits inside another git repository, the CLI may ask about the parent. Add `--noparent-check` to skip that check.

## 3. Watch the rollout

In the UI open **Devices** and then the device. The **Services** section shows each container going from *Downloading* to *Running*, with a progress bar. In a terminal:

```bash
balena device list
balena device logs <uuid> --tail
```

You can also see the new release under **Releases** in the sidebar.

## Useful options

| Option | What it does |
|---|---|
| `--build` | Rebuild everything, ignoring the cache of finished images. |
| `--nocache` | Also ignore Docker's layer cache. Slower, but fixes odd stale builds. |
| `--pull` | Pull the newest base images before building. |
| `--emulated` | Build for a different CPU than your computer (see [Multi-architecture builds](doc:multi-arch)). |
| `--draft` | Create the release but do not roll it out yet (see [Releases and rollouts](doc:releases-rollouts)). |
| `--note "text"` | Attach a note to the release. |
| `--release-tag key value` | Attach a tag to the release. Can be repeated. |
| `--noparent-check` | Skip the parent git repository check. |
| `--source <dir>` | Deploy a folder other than the current one. |
| `--debug` | Print detailed output while building. |
| `--registry-secrets <file>` | Credentials for private base-image registries. |

Run `balena deploy --help` for the full list for your CLI version.

## Build only, without pushing

To check that the project builds without creating a release:

```bash
balena build --fleet MyFleet
```

## Deploy a prebuilt image

If you already built an image with Docker on this machine, `balena deploy` can take it as a second argument instead of building from a project folder:

```bash
docker build -t myapp:1.4.2 .
balena deploy MyFleet myapp:1.4.2
```

The image must exist in your local Docker. This creates a single-container release, so for multi-container apps use a `docker-compose.yml` project instead. Check `balena deploy --help` for how your CLI version handles this.

## A repeatable script

Put the steps in a script so everyone deploys the same way.

```powershell
# deploy.ps1
param([string]$Fleet = "MyFleet")
$ErrorActionPreference = "Stop"
$env:BALENARC_BALENA_URL = "mydomain.com"
$env:NODE_EXTRA_CA_CERTS = "C:\certs\ca.pem"
docker version | Out-Null
balena whoami
balena deploy $Fleet --build
```

```bash
#!/usr/bin/env bash
# deploy.sh
set -euo pipefail
export BALENARC_BALENA_URL=mydomain.com
export NODE_EXTRA_CA_CERTS=/etc/vector/ca.pem
docker version >/dev/null
balena whoami
balena deploy "${1:-MyFleet}" --build
```

## If it fails

The most common failures are listed in [Troubleshooting](doc:troubleshooting#deploy-and-build-problems). In short:

- `x509: certificate signed by unknown authority` means Docker does not trust your CA. See [Docker must trust it too](doc:connect-cli#self-signed-certificates).
- `exec format error` on the device means you built for the wrong CPU. See [Multi-architecture builds](doc:multi-arch).
- `Not logged in` means run `balena login` again.
