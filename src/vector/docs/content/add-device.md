# Add and flash a device

A new device needs a balenaOS image that already knows which Vector server to connect to. The **Add device** page builds that image for you, so you do not have to run `balena os configure` by hand.

## Before you start

- A [fleet](doc:ui-tour) exists whose device type matches your hardware.
- Your computer has about **2 GB of free disk space** for the image. Vector does not keep a copy; the image goes straight to your computer.
- A Chromium browser (Chrome or Edge) if you want to choose the folder the image is saved to. Other browsers save to their own downloads folder.
- DNS and certificates work for devices, not only for your computer (see [Certificates and DNS](doc:certificates-dns)).

## 1. Choose the fleet and OS

Open **Add device** in the sidebar.

1. Pick the **Fleet**. The device type is taken from the fleet.
2. Pick the **balenaOS version**. The newest is selected. Nothing needs to be downloaded in advance. If the list is empty, the Vector server cannot reach balena's version catalog.

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

- **Download flash-ready image** saves a complete balenaOS image with this fleet's configuration already written into it. Vector downloads balenaOS from balena, writes the configuration into the image's boot partition while it streams, and sends the result straight to your computer. **Nothing is stored on the server**, so there is no server disk to fill up. It is large (often over a gigabyte): keep the page open until it finishes. **Cancel** stops it.
- **Download config.json only** gives just the configuration file, for a drive you already flashed.

### Where the image is saved

In **Chrome** and **Edge** the page has a **Save to** box:

- By default it asks each time and starts in your **Downloads** folder.
- **Choose a folder** sets a default folder (for example `D:\balenaOS`). Vector remembers it in this browser and saves there without asking. The browser may ask you to allow access again after you restart it.
- **Ask each time** forgets the folder.

In other browsers (Firefox, Safari) the file goes to the browser's own downloads folder, which you change in the browser's settings.

### Checks and recovery

Vector checks the image at each step, so a bad download is caught instead of flashed:

- **Before anything is prepared**, the page tests the folder by writing and removing a tiny file. A folder that was moved, is read-only or has lost its permission is reported straight away, before a device is registered or a byte is downloaded.
- **Existing files are never replaced.** If `vector-raspberrypi4-64-9.0.3_rev2.img` is already in the folder, the new image is saved as `... (2).img`.
- **While saving**, the page shows the amount saved, the speed and, when the size is known, the percentage and time left. **Cancel** stops it. Your browser writes to a temporary file and only puts the image in place when it is complete, so a cancelled or failed download leaves no half-written image.
- **The server checks the image against the checksum recorded in balena's download.** If it is damaged or cut short, the last part is never sent, the download fails, and nothing is saved.
- **After saving**, the page reads the file back and confirms its size and that it starts like a disk image. You see **Checked** or a warning not to flash it.

If something goes wrong the message says what to do, with a button for the likely fix (**Choose another folder**, **Try again**):

| Message | Meaning |
|---|---|
| Not allowed to write to the folder | The browser needs permission again. Click **Try again** and allow access, or choose another folder. |
| The folder was moved, renamed or removed | Vector forgets the folder. Choose one again. |
| A file is open in another program | Close the program that holds the file, or choose another folder. |
| Not enough free space | The image needs roughly 2 to 8 GB. Free space or choose another drive. |
| The connection was lost | Nothing was saved. **Try again** reuses the image you prepared, so no second device is registered. |

A prepared image can be downloaded up to **5 times** within 30 minutes. After that, or if the page's answers change, it is prepared again.

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
