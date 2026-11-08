# Releases and rollouts

Every successful `balena deploy` creates a **release**: a frozen, versioned snapshot of your software. Releases let you control what each device runs, test before wide rollout, and go back to a known-good version.

## What a release is

A release is identified by a commit hash such as `50be7bdb0ea6819c91a5dd7bcd7635ad`. It contains the images for every service, the compose definition, and any tags and notes you attached. You can see all releases in the UI under **Releases**, or with:

```bash
balena release list MyFleet
```

## Default behaviour: track the latest

By default each device in a fleet runs the **latest finalized release**. When you deploy, the whole fleet updates automatically.

## Test before rolling out (draft releases)

A **draft** release is built and stored but is not rolled out to any device that is tracking the latest.

```bash
balena deploy MyFleet --build --draft
```

Test it on one device by pinning that device to the draft (next section). When you are happy, make it live for everyone:

```bash
balena release finalize <release-id-or-commit>
```

After finalizing, all devices that track the latest receive it.

## Pin a device to a release

Pinning holds a single device on a specific release, ignoring newer ones.

```bash
balena device pin <uuid> <release-commit>
```

Show what a device is pinned to by opening the device in the UI. To make a device follow the fleet again:

```bash
balena device track-fleet <uuid>
```

## Pin the whole fleet

To freeze every device in a fleet on one release, for example during a trade show:

```bash
balena fleet pin MyFleet <release-commit>
```

And to return to tracking the newest finalized release:

```bash
balena fleet track-latest MyFleet
```

## Roll back

Rolling back is just pinning to the older release:

```bash
balena release list MyFleet
balena fleet pin MyFleet <older-release-commit>
```

Devices download (or reuse) the older images and restart their containers. When the problem is fixed and a new release is ready, run `balena fleet track-latest MyFleet`.

> [!WARNING]
> Pinning stops automatic updates for the affected devices. Remember to unpin them, or they will silently stay on an old version.

## Staged rollout pattern

A safe routine for important fleets:

1. Deploy with `--draft`.
2. Pin one or two test devices to the draft release. Watch their **Logs** and **Services** in the UI.
3. If healthy, run `balena release finalize`.
4. If not, fix and deploy a new draft. Unpin the test devices.

## Tag and annotate releases

Attach notes and tags at deploy time so you can find a release later:

```bash
balena deploy MyFleet --build --note "Fixes sensor timeout" --release-tag version 1.4.2
```

Tags appear on the release in the UI and under **Release tags**.

## Update behaviour on the device

Variables on the fleet control how devices update. These are set in the UI under **Fleets**, then **Config Vars**:

| Variable | Effect |
|---|---|
| `RESIN_SUPERVISOR_UPDATE_STRATEGY` | `download-then-kill` (default), `kill-then-download`, `delete-then-download` or `hand-over`. |
| `RESIN_SUPERVISOR_POLL_INTERVAL` | How often a device checks for changes, in milliseconds. |
| `RESIN_SUPERVISOR_LOCAL_MODE` | Local development mode. Disables cloud updates. |

`download-then-kill` keeps the old version running until the new images finish downloading, which keeps downtime short. Use `kill-then-download` on devices with little disk space.

## Clean up

Old releases and images take space in the registry. Deleting a release in the UI removes the entry; pinned and currently running releases should be kept.
