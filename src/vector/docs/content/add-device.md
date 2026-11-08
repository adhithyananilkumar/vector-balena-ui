# Add and flash a device

A new device needs a balenaOS image that already knows which Vector server to connect to. The **Add device** page builds that image for you, so you do not have to run `balena os configure` by hand.

## Before you start

- A [fleet](doc:ui-tour) exists whose device type matches your hardware.
- The balenaOS version you want is downloaded under **Base images** (see [Base images](doc:base-images)).
- DNS and certificates work for devices, not only for your computer (see [Certificates and DNS](doc:certificates-dns)).

## 1. Choose the fleet and OS

Open **Add device** in the sidebar.

1. Pick the **Fleet**. The device type is taken from the fleet.
2. Pick the **balenaOS version**. If the list is empty or the version you want is missing, download it first under **Base images**.

## 2. Choose mode, provisioning and network

| Choice | Option | Meaning |
|---|---|---|
| **Mode** | Production | Locked down. Use this for devices you deploy. |
| | Development | Local mode and open SSH on port 22222. For testing only. |
| **Provisioning** | Fleet-wide | One image works for many devices. Each registers itself on first boot. |
| | This device only | Registers one device now. The image is for that device only. |
| **Network** | Ethernet | Plug in a cable. Nothing else to configure. |
| | Wi-Fi | Joins the network you enter (name and password) on first boot. |
| **DNS servers** | Optional | Resolvers the device uses first. Set this when your server names only exist on a private DNS (see [Certificates and DNS](doc:certificates-dns)). |

> [!WARNING]
> A **Fleet-wide** image lets anyone who has the file add a device to your fleet. Keep it private and do not post it. Use **This device only** for single devices and replacements.

> [!DANGER]
> Never ship a **Development** image to production. It opens a passwordless root shell. Development and production are separate images; one cannot be converted into the other.

## 3. Get your files

Two buttons are offered:

- **Prepare flash-ready image** builds a complete image: the base image plus this fleet's configuration. The download link is valid for **10 minutes** and the copy is deleted after **30**. Download it straight away.
- **Download config.json only** gives just the configuration file, for a drive you already flashed.

If you chose **This device only**, a green note confirms the device was registered. It shows as offline until it boots with this config.

## 4. Write the image to the card

Use [balenaEtcher](https://etcher.balena.io/) (free, Windows, macOS and Linux):

1. **Flash from file**, then choose the downloaded image (`.img` or `.zip`).
2. **Select target**, then choose the SD card or USB drive.
3. **Flash**, and wait for it to verify.

On Windows, run Etcher as administrator if the drive does not appear.

Or use the CLI:

```bash
balena util available-drives
balena local flash image.img --drive /dev/sdX --yes
```

On Windows, take the drive name from `available-drives` instead of `/dev/sdX`.

## 5. Boot the device

Insert the card, connect the cable if you chose Ethernet, and power on. First boot takes a minute or two. In the UI open **Devices**: the device appears, first as offline, then online with its name and OS version.

You can also check from a terminal:

```bash
balena devices
```

## Devices with internal storage

Boards with eMMC or NVMe storage, and ordinary PCs, cannot boot from the card forever. They use an **installer** image: boot from the USB stick, the installer writes balenaOS to the internal disk, then you remove the stick. With a fleet-wide configuration, one installer stick can provision many devices.

## Change the configuration of a flashed drive

The boot partition of a flashed card is a normal FAT drive (label `resin-boot`). To change which server or identity it uses before first boot, replace its `config.json` with a new one from **Download config.json only**.

| Situation | Can the drive be reused? |
|---|---|
| Flashed but **never booted** | Yes. Replace `config.json` freely. |
| **Already booted** in a device | Reflash it. The card now holds that device's identity and state. |
| One `config.json` on **two devices** | No. Two devices with the same identity collide. Only fleet-wide configs may be shared. |
| Development to production | No. Build a new image. |

## Pre-register a device with the CLI

The CLI route does the same as the page above:

```bash
balena device register MyFleet --uuid $(openssl rand -hex 16)
balena config generate --device <uuid> --version <os-version> --network ethernet --output config.json
balena os configure image.img --config config.json
```

A device UUID must be 32 hexadecimal characters.

## If the device never comes online

Check [Device does not come online](doc:troubleshooting#device-does-not-come-online) in Troubleshooting. The usual causes are DNS names that resolve only on your computer, no `balenaRootCA` in the configuration, and port 443 blocked.
