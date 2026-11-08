# CLI cheat sheet

The commands you will use most. Every command accepts `--help`, which is the authority for your CLI version:

```bash
balena --help
balena deploy --help
```

## Setup and login

| Command | Purpose |
|---|---|
| `balena version` | Show the CLI version. |
| `balena login` | Sign in (choose Credentials, or use `--token <API_KEY>`). |
| `balena logout` | Sign out. |
| `balena whoami` | Show the user and the server you are connected to. |

## Environment variables

| Variable | Purpose |
|---|---|
| `BALENARC_BALENA_URL` | Your server domain, for example `mydomain.com`. |
| `NODE_EXTRA_CA_CERTS` | Path to your CA file, for a self-signed server. |
| `BALENARC_NO_ANALYTICS=1` | Turn off CLI analytics. |
| `DEBUG=1` | Print more detail for troubleshooting. |

## Fleets

| Command | Purpose |
|---|---|
| `balena fleets` | List fleets. |
| `balena fleet create MyFleet --type raspberrypi4-64` | Create a fleet. |
| `balena fleet MyFleet` | Show one fleet. |
| `balena fleet rename MyFleet NewName` | Rename. |
| `balena fleet rm MyFleet` | Delete a fleet. |
| `balena fleet pin MyFleet <release>` | Hold the whole fleet on one release. |
| `balena fleet track-latest MyFleet` | Follow the newest finalized release again. |

## Build and deploy

| Command | Purpose |
|---|---|
| `balena deploy MyFleet --build` | Build locally, push to the registry, create a release. |
| `balena deploy MyFleet --build --emulated` | Same, for a different CPU architecture. |
| `balena deploy MyFleet --build --draft` | Create the release without rolling it out. |
| `balena deploy MyFleet --noparent-check` | Skip the parent git repository check. |
| `balena deploy MyFleet <image>` | Deploy an image that already exists in local Docker. |
| `balena build --fleet MyFleet` | Build without pushing. |

## Releases

| Command | Purpose |
|---|---|
| `balena release list MyFleet` | List releases. |
| `balena release <id>` | Show one release. |
| `balena release finalize <id>` | Make a draft release live. |

## Devices

| Command | Purpose |
|---|---|
| `balena devices` | List all devices. |
| `balena devices --fleet MyFleet` | List one fleet's devices. |
| `balena device <uuid>` | Show one device. |
| `balena device register MyFleet --uuid <uuid>` | Register a device ahead of time. |
| `balena device rename <uuid> NewName` | Rename. |
| `balena device move <uuid> --fleet OtherFleet` | Move to another fleet. |
| `balena device restart <uuid>` | Restart the containers. |
| `balena device reboot <uuid>` | Reboot the device. |
| `balena device pin <uuid> <release>` | Hold one device on a release. |
| `balena device track-fleet <uuid>` | Follow the fleet again. |
| `balena device rm <uuid>` | Remove the device from the server. |

## Logs and access

| Command | Purpose |
|---|---|
| `balena logs <uuid> --tail` | Follow device logs. |
| `balena logs <uuid> --service web` | Logs of one service. |
| `balena ssh <uuid>` | Shell on the device (Host OS). |
| `balena ssh <uuid> web` | Shell inside the `web` container. |

> [!NOTE]
> `balena ssh` needs an SSH key on your account. The Vector UI terminal needs no key. See [Remote access](doc:remote-access).

## Variables and tags

| Command | Purpose |
|---|---|
| `balena env list --fleet MyFleet` | List fleet variables. |
| `balena env add NAME value --fleet MyFleet` | Add a fleet variable. |
| `balena env rm <id>` | Remove a variable. |
| `balena tags --fleet MyFleet` | List tags. |
| `balena tag set key value --device <uuid>` | Set a device tag. |

## Images and provisioning

| Command | Purpose |
|---|---|
| `balena os versions raspberrypi4-64` | List balenaOS versions for a device type. |
| `balena os download raspberrypi4-64 -o os.img` | Download an image. |
| `balena config generate --fleet MyFleet --version <v> --network ethernet -o config.json` | Make a `config.json` for the fleet. |
| `balena config generate --device <uuid> --version <v> -o config.json` | Make one for a single device. |
| `balena os configure os.img --fleet MyFleet` | Write the configuration into an image. |
| `balena os configure os.img --config config.json` | Use a `config.json` you already have. |
| `balena util available-drives` | List drives you can flash to. |
| `balena local flash os.img --drive <drive> --yes` | Flash an image to a drive. |

Add `--dev` to `os configure` for a development image. Add `--network wifi --wifiSsid "<ssid>" --wifiKey "<password>"` to `config generate` for Wi-Fi.

## Windows quick setup

```powershell
$env:BALENARC_BALENA_URL = "mydomain.com"
$env:NODE_EXTRA_CA_CERTS = "C:\certs\ca.pem"
balena login
balena fleets
```

## Linux and macOS quick setup

```bash
export BALENARC_BALENA_URL=mydomain.com
export NODE_EXTRA_CA_CERTS=$HOME/certs/ca.pem
balena login
balena fleets
```

## Server commands (on the server)

| Command | Purpose |
|---|---|
| `make up` | Start the server. |
| `make down` | Stop it. |
| `make restart` | Restart it. |
| `make update` | Update openBalena. |
| `make verify` | Ping the public API. |
| `make self-signed` | Register the self-signed CA on the host. |
| `make auto-pki` | Get a trusted certificate (Let's Encrypt). |
| `make pki-custom` | Use your own certificate. |
| `docker compose logs -f api` | Follow a service's logs. |
| `docker compose ps` | Show service status. |
