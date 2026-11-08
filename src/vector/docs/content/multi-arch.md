# Multi-architecture builds

Devices run on different CPUs: Raspberry Pi 4 is `aarch64`, older Pis are `armv7hf`, and PCs are `amd64`. A container image only runs on the CPU it was built for. Building on your own computer means you must make sure the image matches the **fleet**, not your computer.

## Why it matters

If your computer is `amd64` (most Windows and Linux PCs) and the fleet is `aarch64`, a normal Docker build produces the wrong image. The device downloads it, then the container crashes with:

```text
exec /usr/bin/node: exec format error
```

## Choose the right base image

`balenalib` base images are published for every architecture. Use a **template** so the correct one is picked for the fleet:

```dockerfile
# Dockerfile.template
FROM balenalib/%%BALENA_MACHINE_NAME%%-node:20-run
```

Available placeholders:

| Placeholder | Example value |
|---|---|
| `%%BALENA_MACHINE_NAME%%` | `raspberrypi4-64` |
| `%%BALENA_ARCH%%` | `aarch64` |

When you run `balena deploy MyFleet`, the CLI reads the fleet's device type and fills these in.

## Option 1: emulation (simplest)

Let the CLI build for the fleet's architecture using QEMU emulation:

```bash
balena deploy MyFleet --build --emulated
```

This is the easiest option and works everywhere Docker Desktop runs. It is slower, often 3 to 10 times, and heavy compile steps can take a long time.

> [!TIP]
> Keep the slow work out of the Dockerfile. Install prebuilt packages instead of compiling from source, and order your `COPY` lines so the dependency install layer is cached.

## Option 2: buildx for the target platform

If you want to control the build yourself, use Docker buildx with the target platform. For a 64-bit Pi:

```bash
docker buildx create --use
docker buildx build --platform linux/arm64 -t myapp:1.0 --load .
balena deploy MyFleet myapp:1.0
```

| Fleet architecture | Docker platform |
|---|---|
| `aarch64` | `linux/arm64` |
| `armv7hf` | `linux/arm/v7` |
| `rpi` | `linux/arm/v6` |
| `amd64` | `linux/amd64` |
| `i386` | `linux/386` |

## Option 3: build on matching hardware

If your build machine has the same CPU as the devices, for example an Apple silicon Mac for an `aarch64` fleet, no emulation is needed. Note that Docker Desktop on Apple silicon already builds `arm64` images by default.

## Check what you built

```bash
docker image inspect myapp:1.0 --format "{{.Architecture}}"
```

The answer must match the fleet. To see a fleet's device type:

```bash
balena fleet MyFleet
```

## One fleet, one architecture

A fleet holds devices of **one** CPU architecture. To support both Pi 4 (`aarch64`) and an Intel PC (`amd64`), create two fleets and deploy to each.
