# Install the CLI

The balena CLI is the tool that builds your software and pushes it to Vector. It is open source (Apache-2.0). Install it, together with Docker, on every machine that will deploy: your laptop, a build PC or a CI runner.

## Requirements

- **balena CLI v18.2.2 or newer.** The current release line is v25.
- **Docker** (Docker Desktop on Windows and macOS, Docker Engine on Linux) running while you deploy.
- Network access from that machine to your server's `api` and `registry2` hostnames on port 443.

## Install on Windows

1. Download the Windows installer from the [balena CLI releases page](https://github.com/balena-io/balena-cli/releases/latest). It is named like `balena-cli-vX.Y.Z-windows-x64-installer.exe` and is about 110 MB.
2. Run it and finish the wizard.
3. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
4. Open a **new** PowerShell window and check:

```powershell
balena version
docker version
```

## Install on macOS

Download the `.pkg` installer for your chip (Apple silicon or Intel) from the releases page and run it. Or use the standalone archive:

```bash
tar -xzf balena-cli-vX.Y.Z-macOS-arm64-standalone.tar.gz
sudo mv balena-cli /usr/local/lib/balena-cli
sudo ln -s /usr/local/lib/balena-cli/bin/balena /usr/local/bin/balena
```

## Install on Linux

Download the standalone archive for `x64` or `arm64` and unpack it:

```bash
tar -xzf balena-cli-vX.Y.Z-linux-x64-standalone.tar.gz
sudo mv balena-cli /usr/local/lib/balena-cli
sudo ln -s /usr/local/lib/balena-cli/bin/balena /usr/local/bin/balena
balena version
```

Install Docker Engine with your distribution's instructions, and add your user to the `docker` group so you do not need `sudo`:

```bash
sudo usermod -aG docker $USER
```

Log out and in again for the group change to apply.

## Install with npm

If you already have Node.js installed:

```bash
npm install -g balena-cli --production --unsafe-perm
```

## Update the CLI

Download and run the newer installer, or repeat the npm command. Check the version afterwards:

```bash
balena version
```

> [!WARNING]
> The CLI must be new enough for your server. If you see unexpected API errors after upgrading the server, upgrade the CLI too. The server needs v18.2.2 or newer.

## Next step

The CLI still points at balenaCloud. Continue with [Connect the CLI to Vector](doc:connect-cli).
