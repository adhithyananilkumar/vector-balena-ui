# Remote access

The **Connect** button on a device opens a shell on the device from your browser. There is no VPN client or SSH key to set up on your computer.

## What you can do

- Open a terminal in the **Host OS** or in any running **app container**.
- Open several terminals at once with `+`, and expand one to fill the window.
- **Upload** and **download** files to and from the Host OS or a container.

Terminals appear in this order: Host OS, app services, then supported supervisor services.

## Requirements

- The device must be **online**, since access runs over the device's connection to the server.
- A user with permission to see the device.
- Remote access configured on the server (see below).

## Terminals

1. Open the device and press **Connect**.
2. Choose the target: Host OS or a container.
3. Use the terminal like any shell.

Closing a tab closes its shell. Idle shells are kept alive. Device refreshes do not disconnect a terminal.

## File transfer

The Upload/Download panel has its own Host OS/container selector.

- Enter an **absolute path** inside the chosen filesystem.
- Progress and a cancel button are shown.
- Container transfers use the host's SFTP against the container's filesystem, so no SFTP server is needed inside your image.
- Large uploads are limited (1 GiB by default). See the limits below.

> [!NOTE]
> Browsers that support streamed saves ask you where to save **before** the file is checked. If the path does not exist, the error appears after the save prompt. No bytes are written when the check fails.

## How it is set up on the server

There are two modes.

**Built-in (recommended).** Vector connects to devices through the openBalena VPN service. Set the tunnel endpoint:

```bash
OPEN_BALENA_TUNNEL_URL=http://ob-vpn.openbalena.svc.cluster.local:3128
REACT_APP_OPEN_BALENA_REMOTE_URL=
```

Leave `REACT_APP_OPEN_BALENA_REMOTE_URL` empty so the built-in mode is selected. The tunnel URL is the VPN service's internal CONNECT endpoint, not the public port 443.

**Legacy.** Set `REACT_APP_OPEN_BALENA_REMOTE_URL` to an `open-balena-remote` service. It also supports exposing HTTP, HTTPS and VNC services from containers with labels.

## Behind a reverse proxy

When TLS is terminated by a proxy, tell Vector the public origin and which proxies to trust:

```bash
OPEN_BALENA_REMOTE_PUBLIC_ORIGIN=https://admin.mydomain.com
OPEN_BALENA_REMOTE_TRUSTED_PROXIES=10.0.0.10/32
```

Trust only your ingress proxy addresses, never whole client ranges.

## Limits you can tune

| Variable | Default | Controls |
|---|---|---|
| `OPEN_BALENA_REMOTE_CONNECT_TIMEOUT_MS` | 15000 | Time to open a connection. |
| `OPEN_BALENA_REMOTE_MAX_OPERATIONS_PER_USER` | 8 | Concurrent terminals and transfers per user. |
| `OPEN_BALENA_REMOTE_MAX_WEBSOCKETS_PER_IP` | 8 | Pre-login connections per client IP. Raise it behind a shared NAT. |
| `OPEN_BALENA_REMOTE_MAX_CHANNELS_PER_SOCKET` | 4 | Terminals per browser connection. |
| `OPEN_BALENA_REMOTE_MAX_UPLOAD_BYTES` | 1073741824 | Largest upload (1 GiB). |
| `OPEN_BALENA_REMOTE_MAX_MESSAGE_BYTES` | 1048576 | Largest WebSocket message (1 MiB). |
| `OPEN_BALENA_SSH_KEY_IDLE_TTL_MS` | 600000 | How long a temporary SSH key stays after the last session closes. |

## Host-key checking

Pin each device's SSH host key for strict verification:

```bash
OPEN_BALENA_SSH_HOST_KEYS=<uuid>=SHA256:<fingerprint>
```

Leave `OPEN_BALENA_SSH_ALLOW_UNVERIFIED_HOST_KEYS=false` unless you must support devices without pins.

## Security model

Each session uses a short-lived SSH key made for you, removed after the last session closes plus the idle delay. Browser WebSocket connections authenticate with a single-use ticket that expires after 30 seconds. Origins are checked against `OPEN_BALENA_REMOTE_PUBLIC_ORIGIN`.

For the full design, read `REMOTE_ACCESS_ARCHITECTURE.md` in the Vector UI repository.

## Problems

See [Remote access does not connect](doc:troubleshooting#remote-access-does-not-connect).
