# Quick start

From nothing to a running deployment on one device. It assumes the Vector server is already running. If it is not, start with [Server setup](doc:server-setup).

You will need:

- the domain of your Vector server (this page uses `mydomain.com`)
- an admin email and password for it
- a computer with Docker and the balena CLI (see [Install the CLI](doc:install-cli))
- one supported device (for example a Raspberry Pi) and an SD card

## 1. Install the tools

Install Docker and the balena CLI on your computer, then check them:

```bash
docker version
balena version
```

Details and downloads are in [Install the CLI](doc:install-cli).

## 2. Point the CLI at your server

The CLI talks to balenaCloud by default. Tell it to use your server and to trust your certificate authority:

```bash
export BALENARC_BALENA_URL=mydomain.com
export NODE_EXTRA_CA_CERTS=/path/to/ca.pem
```

```powershell
$env:BALENARC_BALENA_URL = "mydomain.com"
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\ca.pem"
```

Full explanation, including making this permanent: [Connect the CLI to Vector](doc:connect-cli).

## 3. Log in

```bash
balena login
balena whoami
```

Choose **Credentials** and use your admin email and password. `balena whoami` should print your username and `mydomain.com`.

## 4. Create a fleet

Either in the UI (**Fleets**, then **Create**) or with the CLI:

```bash
balena fleet create MyFleet --type raspberrypi4-64
```

The device type decides the CPU architecture, so choose the type that matches your hardware.

## 5. Download a base image

In the UI open **Base images**, pick the device type and a balenaOS version, and press **Download**. This is a one-time download that every device of that type reuses. See [Base images](doc:base-images).

## 6. Create the flash image

Open **Add device**, choose the fleet, balenaOS version, network and mode, then download the image. See [Add and flash a device](doc:add-device).

## 7. Flash and boot

Write the image to the SD card with balenaEtcher, put the card in the device and power it on. After a minute or two the device appears in **Devices** and shows as online.

## 8. Deploy your software

In a folder with a `Dockerfile` (or `docker-compose.yml`):

```bash
balena deploy MyFleet --build
```

The CLI builds on your computer, pushes to your registry and creates a release. The device downloads it automatically. Follow the full guide in [Deploy from your computer](doc:deploy-local).

## 9. Check that it worked

```bash
balena devices
balena logs <uuid> --tail
```

Or open the device in the UI and watch **Services** and **Logs**.

> [!TIP]
> If any step fails, look the message up in [Troubleshooting](doc:troubleshooting). The most common causes are a missing CA certificate and DNS names that do not resolve.
