# Base images

A **base image** is an unconfigured balenaOS image for one device type and version. Vector downloads it once and keeps it, so every device of that type reuses it. Without this, each new device would mean a download of a gigabyte or more.

## Where the images come from

Your Vector server does not host balenaOS. Images are fetched from balena's public download service (by default `https://api.balena-cloud.com`) and stored on the machine that runs the Vector UI.

The server needs internet access to that service when you download, but not afterwards.

## Download an image

1. Open **Base images** in the sidebar.
2. Under **Download a base image**, choose the **Device type**.
3. Choose the **balenaOS version**. The newest is marked *latest*.
4. Press **Download**.

Progress shows as **Downloading** and then **Unpacking**. Images download **one at a time**; the button is disabled while another download runs.

When it finishes, the image appears as **ready** in the list and becomes available on the [Add device](doc:add-device) page.

## Delete an image

Deleting only frees disk space. You can download the same image again later. Delete old versions you no longer use.

## Storage

Each image is several hundred megabytes, and more once unpacked. Keep several gigabytes of free space for each device type you use.

The folder defaults to `./data/base-images`. Change it with the environment variable:

```bash
VECTOR_BASE_IMAGES_DIR=/srv/vector/base-images
```

Use a persistent disk. If the folder is lost, you must download the images again.

## Use a different image source

To list versions and download from a different service, set:

```bash
VECTOR_OS_CATALOG_API_URL=https://api.balena-cloud.com
```

## Problems

| Symptom | Likely cause and fix |
|---|---|
| The version list stays empty | The server cannot reach the catalog. Check outbound internet access and `VECTOR_OS_CATALOG_API_URL`. |
| Download starts then fails | Not enough disk space, or the connection dropped. Free space and try again. |
| The device type is missing | The device type is not in your server's list. See **Device Types** under Static data. |
| **Add device** says there is no base image | Download the exact OS version you selected first. |

See also [Troubleshooting](doc:troubleshooting).
