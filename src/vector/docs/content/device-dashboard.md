# The device dashboard

Open any device from **Devices** to see its dashboard. It combines status, containers, logs, variables and controls in one place.

## Status and updates

The page refreshes automatically:

- About every **30 seconds** when the device is steady.
- About every **second** while an operation is in progress, for example a download, or an OS or supervisor update.

Polling only runs while the browser tab is in the foreground, so a background tab does not generate load.

## Services

The Services section lists the containers of your app, and of the supervisor on newer versions. During an update each row shows both the current and the incoming state, such as *Running → Downloading*, with a download progress bar and the current and incoming release.

Per service you can start, stop and restart the container.

| State | Meaning |
|---|---|
| Downloading | Images are being pulled from the registry. |
| Downloaded | Image is ready but not started yet. |
| Running | The container is up. |
| Stopping / Stopped | The container is shutting down or is stopped. |
| Installing | The container is being created. |

## OS updates

Host OS updates show the updater's stage and a coarse progress value under **Host OS Version**. This is stage-based progress, not a download percentage. Initial provisioning is not shown as an update.

See your server's `OS_AND_SUPERVISOR_UPDATES.md` for details on image delivery and requirements.

## Logs

Logs update about every **two seconds** while at least one source is selected.

- Use the **App** and **Supervisor** menus to choose sources. **Host OS** is the first entry of the Supervisor menu.
- The log buttons next to services toggle the same selection.
- Clearing all selections stops polling and empties the viewer.
- **Search** is case-insensitive. **Add filter** supports message and timestamp conditions; **Add alternative** combines conditions with OR. Separate filters and the search box combine with AND.
- **Download** saves the currently shown, filtered entries as plain text. **Clear** empties the view and hides older history.
- The browser keeps at most **5,000** entries. For longer history, use the CLI:

```bash
balena logs <uuid> --tail
balena logs <uuid> --service web --since 1h
```

Colours: ANSI colours are kept, and JSON logs with a `level` or `severity` field are coloured by severity.

## Variables

Variables are set at several levels, and the more specific level wins.

| Level | Where to set | Applies to |
|---|---|---|
| Fleet | **Fleets**, then Environment Vars | Every device in the fleet. |
| Device | Device page, or **Devices**, Environment Vars | One device. |
| Service | Device page, **Service Vars** | One service on one device. |

**Config vars** (names starting `RESIN_` or `BALENA_`) change device and supervisor behaviour, such as polling and the update strategy. Environment variables are passed to your containers.

A change to a variable restarts the affected containers.

## Tags

Tags are free labels on fleets, devices and releases, for example `site=berlin`. Use them to find and group devices. Filters in the device list can use them.

## Pin a release

Under **Target release** you can pin the device to a specific release or let it follow the fleet. See [Releases and rollouts](doc:releases-rollouts).

## Connect to the device

The **Connect** button opens a terminal and file transfer in your browser. See [Remote access](doc:remote-access).

## Share a link

A device is also reachable at `/devices/<UUID>/summary`, which redirects to its dashboard. This matches the link the `balena devices` command prints.
