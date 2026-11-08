# Device features

What the device dashboard offers and how it behaves in the browser.

## Device logs

The device dashboard polls logs automatically about every two seconds while at least one source is selected. Use the App
and Supervisor checklist menus to combine sources; Host OS is the first Supervisor-menu entry. The log buttons in
service tables toggle the same selections. Clearing all selections empties the viewer and stops polling.

Log contents use the terminal's monospace font. ANSI colors are preserved safely, and structured JSON `level`/`severity`
fields color informational, warning, and error messages. Download exports the currently displayed, filtered entries as
plain text. Clear removes existing entries and prevents old API history from reappearing on subsequent polls or source
changes; the cutoff resets when the viewer is reloaded or a different device is opened.

Search is case-insensitive. **Add filter** supports message and timestamp conditions, with **Add alternative** combining
conditions using OR. Separate filters and the search query combine using AND. Timestamp inputs use local time and are
stored as timezone-qualified ISO timestamps. The browser retains at most 5,000 captured entries, not unlimited device
history. See [REMOTE_ACCESS_ARCHITECTURE.md](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/remote-access.md#device-log-viewer) for details.

## Exposing Device Connection Endpoints

Each device has a "Connect" button. Built-in mode offers Host OS and running application-container SSH targets without
requiring image labels. Targets are ordered Host OS, App services, then supported Supervisor services; the same service
colors and ordering are used in the service tables and logs picker. Use `+` to add independent terminal tabs and the
expand button to fill the browser viewport without reconnecting sessions or hiding the device name. Close a shell using
its tab's `X`. Idle shells are kept alive on both the browser WebSocket and upstream SSH tunnel. The Upload/Download
panel has an independent Host OS/container selector with the terminal's ordering and colors. Enter an absolute path
inside the selected filesystem to upload or download; progress and cancellation are shown. Container transfers use host
SFTP against the running container's filesystem and require no SFTP server inside the image. Supported browsers stream
downloads into a chosen local file; other browsers use a clearly indicated browser-memory fallback. See
[REMOTE_ACCESS_ARCHITECTURE.md](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/remote-access.md) for session ownership, authentication, and transfer
limitations.

Successful downloads display the actual received byte count alongside the source path.

Upload and download retain separate filesystem selections. Container requests explicitly distinguish ordinary
service-label selection from canonical Supervisor selection, so an App service named `balena_supervisor` remains an App
target rather than opening Supervisor core. Connected terminal tabs retain the target label used for that session even
if a later device refresh temporarily removes or renames its picker entry.

**Download save-prompt timing:** Browsers supporting streamed saves show the destination picker before checking the
remote file. The picker requires transient user activation from the Download click; waiting for remote authorization and
SSH/SFTP checks first can exhaust that activation and prevent the picker from opening. Consequently, errors such as "No
such file", permission errors, or connection failures appear after the save prompt, for both Host OS and container
downloads. Remote validation failures occur before downloaded bytes are written. We intentionally do not pre-check paths
while typing: that would add debouncing delays and remote requests, and a successful check cannot guarantee the file
still exists or remains readable when the download begins. Browsers using the browser-memory fallback instead fetch the
file successfully before triggering the local download.

The HTTP, HTTPS, and VNC label discovery described below is available only through the legacy `open-balena-remote` flow.
To make use of that legacy auto-discovery, add tags to each container within your application's `docker-compose` file
where you would like to expose services. Examples of the three types of services available to expose are provided below
(http, https and vnc); note that ssh services are enabled by default and do not need labels. When a device is running an
application that exposes container services using the label constructs below, you will see the service appear in the
list of available connections for that container when clicking the "Connect" button for that device in the admin ui.

HTTP Services:

```sh
    labels:
      openbalena.remote.http: '1'
      openbalena.remote.http.port: '5003'
      openbalena.remote.http.path: '/'
```

HTTPS Services:

```sh
    labels:
      openbalena.remote.https: '1'
      openbalena.remote.https.port: '1880'
      openbalena.remote.https.path: '/nr-admin'
```

VNC Services:

```sh
    labels:
      openbalena.remote.vnc: '1'
      openbalena.remote.vnc.port: '5900'
```

**Note**: The port specified above is a host container port, so the service needs to be mapped to a host port matching
the port specified in the label in your `docker-compose` file.

## Dashboard URL Routes

`Vector UI` includes routes that conform to the standard balena convention that you will see when running
`balena devices` using `balena-cli`. Specifically, if you point your browser to your `Vector UI` server with a path
of `/devices/<UUID>/summary`, it will redirect you to the dashboard for that device. If you point the
`dashboard.yourdomain.com` host to your `Vector UI` instance, the URL should conform to the standard balena
convention.
