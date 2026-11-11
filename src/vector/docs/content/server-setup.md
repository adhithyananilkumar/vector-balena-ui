# Server setup

This page installs the openBalena backend that Vector runs on. Do it once, on a Linux server that devices can reach over the internet or your network.

## What you need

- A Linux server (tested on Ubuntu 20.04, 22.04 and 24.04, x64) with **at least 2 GB of memory**.
- Docker Engine installed and root access.
- A **domain name** you control, with DNS you can edit.
- Port **443** open from devices and users to the server.

## 1. Create the DNS records

Point these names at the server's public address. A single wildcard record `*.mydomain.com` also works.

```text
api.mydomain.com
ca.mydomain.com
cloudlink.mydomain.com
logs.mydomain.com
ocsp.mydomain.com
registry2.mydomain.com
s3.mydomain.com
tunnel.mydomain.com
vector.mydomain.com
```

`vector.mydomain.com` is the HTTPS address of the Vector server, which the UI calls. The UI itself (for example `admin.mydomain.com`) is a static site on another host, so its record points there (see [Certificates and DNS](doc:certificates-dns)). If the domain is on Cloudflare, create the records as **DNS only** (grey cloud).

> [!WARNING]
> Use a real domain. Names ending in `.local` do not work for devices, because `.local` is reserved for multicast DNS and a `hosts` file edit only helps the computer you made it on.

## 2. Install the prerequisites

```bash
sudo apt-get update && sudo apt-get install -y make openssl git jq
which docker || curl -fsSL https://get.docker.com | sh -
```

## 3. Create a service user

```bash
sudo useradd -s /bin/bash -m -G docker,sudo balena
echo 'balena ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/balena
sudo su balena
```

## 4. Get openBalena and start it

Vector's backend is the `vector-balena` repository (openBalena plus the Vector server). Its composition builds `../open-balena-postgrest`, so clone both side by side:

```bash
git clone https://github.com/adhithyananilkumar/vector-balena.git ~/vector-balena
git clone https://github.com/ob-community/open-balena-postgrest.git ~/open-balena-postgrest
cd ~/vector-balena
export DNS_TLD=mydomain.com
export VECTOR_ALLOWED_ORIGINS=https://admin.mydomain.com   # where the UI is hosted
export VECTOR_PUBLIC_URL=https://vector.${DNS_TLD}
make up
```

At the end the command prints `SUPERUSER_EMAIL` and `SUPERUSER_PASSWORD`. **Write them down**. They are your first admin login, and you need them for `balena login`. To read the password again later: `docker compose exec api cat config/env | grep SUPERUSER_PASSWORD`.

> [!NOTE]
> **ARM servers (aarch64, for example Oracle Ampere):** the `sut` and `dut` test services cannot be built on ARM, so `make up` fails. Start only the real services:
>
> ```bash
> docker compose up --build -d balena-ca cert-manager db docker redis s3 api postgrest tag-sidecar \
>   haproxy registry delta vector-server haproxy-sidecar vpn
> ```
>
> The first start takes several minutes. `haproxy` restarts until the certificate has been created; that is normal.

If your Vector fork keeps its own copy of the composition, run the same commands in that folder.

## 5. Check it

```bash
make self-signed
make verify
```

`make verify` calls the public API ping. It must succeed.

## 6. Day-to-day operation

| Task | Command |
|---|---|
| Follow a service's logs | `docker compose logs -f api` |
| Stop the server | `make down` |
| Start it again | `make up` |
| Restart | `make restart` |
| Update | `make update` |
| List the services | `docker compose ps` |

The services are: `api`, `registry`, `vpn`, `db`, `s3`, `redis`, `haproxy`, `haproxy-sidecar`, `cert-manager`, `balena-ca`, `tag-sidecar`, `postgrest`, `delta` and `vector-server`.

## 7. Check the Vector server and host the UI

The Vector server starts with the rest of the stack. Check it through its public HTTPS address (haproxy routes `vector.mydomain.com` to it):

```bash
curl https://vector.mydomain.com/healthz   # {"ok":true}
```

`VECTOR_ALLOWED_ORIGINS` must be the address where the UI is hosted. See [Configuration reference](doc:configuration).

The Vector UI is a static website. On Vercel, import the `vector-balena-ui` repository and add these environment variables (they are read when the site is built, so **redeploy** after adding or changing them):

| Name | Value |
|---|---|
| `REACT_APP_OPEN_BALENA_API_URL` | `https://api.mydomain.com` |
| `REACT_APP_OPEN_BALENA_API_VERSION` | `v52.2.3` |
| `REACT_APP_VECTOR_SERVER_URL` | `https://vector.mydomain.com` |

On another static host, build it with the same settings and upload the output:

```bash
npm ci
npm run build   # writes dist/client
```

Browse to the UI address and log in with the superuser email and password.

## 8. Next steps

1. Replace the self-signed certificate with a trusted one for production. See [Certificates and DNS](doc:certificates-dns).
2. Enable access control. See [Access control](doc:access-control).
3. Set up your computer. See [Install the CLI](doc:install-cli).
4. Back up the database and S3 data (below).

## Back up

Back up these, on a schedule and off the server:

- the **database** volume (`db`),
- the **S3** volume (registry images and OS metadata),
- the `.balena` folder and `.env` (certificates and secrets).

```bash
docker compose exec db pg_dumpall -U docker > vector-backup.sql
```

Test a restore on a spare machine before you rely on it.

## Upgrade

```bash
make update
```

Before upgrading read the release notes. For a major upgrade the safest path is a new server in parallel, then copy state across and point a test device at it. After upgrading the server, upgrade the balena CLI and check `REACT_APP_OPEN_BALENA_API_VERSION` in the UI.

## Compatibility

| Component | Minimum |
|---|---|
| balenaOS on devices | 5.2.8 |
| balena CLI | 18.2.2 |
| Node.js (Vector UI) | 24 |
