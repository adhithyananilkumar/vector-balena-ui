# Add and flash a device

A new device needs a balenaOS image that already knows which Vector server to connect to. The **Add device** page walks you through it in four steps, one section at a time, so you do not have to run `balena os configure` by hand. The list on the left shows where you are and your answer in each step; completed steps can be reopened.

## Before you start

- A [fleet](doc:ui-tour) exists whose device type matches your hardware.
- Your computer has free disk space for the images. balenaOS images are large (roughly 1 to 8 GB depending on the device). Vector keeps no copy on the server.
- A Chromium browser (Chrome or Edge) to use a local images folder. Other browsers can still download an image or config.json, but there is no local library.
- DNS and certificates work for devices, not only for your computer (see [Certificates and DNS](doc:certificates-dns)).

## 1. Fleet and operating system

1. Pick the **Fleet**. The device type is taken from the fleet.
2. Pick the **balenaOS version**. The newest is selected. If the list is empty, the Vector server cannot reach balena's version catalog.

## 2. Mode and network

| Choice | Option | Meaning |
|---|---|---|
| **Mode** | Production | Locked down. Use this for devices you deploy. |
| | Development | Local mode and open SSH on port 22222. For testing only. |
| **Network** | Ethernet | Plug in a cable. Nothing else to configure. |
| | Wi-Fi | Joins the network you enter (name and password) on first boot. The name is required to continue. |
| **DNS servers** | Optional | Resolvers the device uses first. Set this when your server names only exist on a private DNS (see [Certificates and DNS](doc:certificates-dns)). |

> [!DANGER]
> Never ship a **Development** image to production. It opens a passwordless root shell. Development and production are separate images; one cannot be converted into the other.

## 3. The device

Add the device to the fleet **first**. It then exists straight away and shows as **Awaiting first boot** (offline) in the device list, the fleet card and its own page until it boots.

| Option | Meaning |
|---|---|
| **New device** | Type an optional name and press **Add device to <fleet>**. You can add another, or remove the device again from the same step. |
| **Registered** | Pick a device already in the fleet. It gets a new key, written into what you install; its old key keeps working until it is reflashed. |
| **Many devices** | One fleet-wide image and nothing is added now. Each device registers itself on first boot. |

> [!WARNING]
> A **Many devices** image lets anyone who has the file add a device to your fleet. Keep it private and do not post it. Use a single device for replacements.

## 4. Install the OS

### Choose where images are kept

**Choose a folder** (Chrome or Edge) picks a folder on your computer, for example `D:\balenaOS`. Vector remembers it in this browser; the browser may ask you to allow access again after a restart. **Change folder** and **Forget folder** are next to it.

### Base image

balenaOS for your device type and version is downloaded **once** into that folder as a base image (`balenaOS-<type>-<version>.img`) and reused for every device. When it is already there the page says so and nothing is downloaded. It is checked against balena's checksum, and a half-finished file is never left behind.

The download can take many minutes. It **keeps going when you leave the page**:

- A progress card follows you to every other page, with **Cancel**.
- On a device's own page, **Install the OS** shows the same live progress and offers **Download OS image** and **Download config.json** again at any time.
- If the connection drops it continues where it stopped.
- Close the tab and it stops; the browser warns you first.

### Create the flash-ready image

**Create image** copies the base image and writes this device's configuration into the copy, on your computer. It is quick, because the base is already local. The result is named after the fleet and device and is never overwritten (a second one gets `(2)`).

### Config only

**Download config.json only** gives just the configuration file, for a drive that already runs balenaOS. It works at any time, including while a base image is downloading.

With **Wi-Fi** selected you also get a second file, `resin-wifi-01`. balenaOS joins Wi-Fi from that file, not from config.json, so copy it into the `system-connections` folder of the boot partition next to config.json. A full image already contains it.

### Checks and recovery

- The folder is tested with a tiny file before anything starts, so a moved, read-only or locked folder is reported at once.
- The page reads the saved file back and shows **Checked** or a warning not to flash it. A cancelled or failed save leaves no half-written image.
- Common messages:

| Message | Meaning |
|---|---|
| Not allowed to write to the folder | The browser needs permission again. Press **Try again** and allow access, or choose another folder. |
| The folder was moved, renamed or removed | Vector forgets the folder. Choose one again. |
| A file is open in another program | Close it, or choose another folder. |
| Not enough free space | Free space or choose another drive. |
| The base image does not match | The local base image changed or is damaged. Download it again. |

A device added in step 3 stays in the fleet if you close the page. Open it from **Devices** and use **Install the OS** to continue.

## 5. Write the image to the card

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

## 6. Boot the device

Insert the card, connect the cable if you chose Ethernet, and power on. First boot takes a minute or two. In the UI open **Devices**: the device appears, first as offline, then online with its name and OS version.

You can also check from a terminal:

```bash
balena device list
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
