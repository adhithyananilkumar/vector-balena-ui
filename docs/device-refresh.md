# Device refresh behavior

Pending changes settle only from device/install requests started strictly after acknowledgment, not responses that
merely finish later. Supervisor version choices use the release ID resolved by the save endpoint before acknowledgment,
so completing a version-based update returns polling to its steady-state interval.

Managed dashboard widgets use the refresh owner's current installation snapshot, loading state, and errors rather
than a second permanently fresh installation query. External container state and release changes therefore update
service statuses, terminal/file-transfer choices, and log sources without manual invalidation. Standalone widgets keep
their own adaptive polling when no matching refresh owner is present.

- Device lists (including dashboard device cards) refresh every 30 seconds. Visible rows reporting configuration or
  deployment activity refresh in batched requests approximately every second, without refetching the entire list or
  changing its membership, ordering, or pagination. Offscreen rows do not start fast polling.
- A device's show page refreshes device state and service installation state every 30 seconds when steady. It switches
  to approximately one-second polling when the device reports an ongoing operation, including on initial page load, or
  when its effective Host OS, Supervisor, or application target has not yet been reached.
- Editing those targets or starting, stopping, or restarting a container immediately enables fast polling. An accepted
  request remains tracked until fresh, post-acknowledgment state shows completion, failure, or a superseding target; an
  unchanged pre-request snapshot cannot complete it. Failed requests stop being tracked. Queued changes remain pending
  until the device reports an outcome; polling does not invent a timeout or cancel device operations.
- The show page shares its device and installation queries across the summary and service widgets instead of running
  independent timers. Immutable release metadata is cached separately; fleet/latest-release discovery remains on a
  30-second cadence. Historical installations from unrelated releases do not keep a settled device polling rapidly.
- App services pair the running release's image installs with the target release's installs by service ID. During
  updates, each row shows both reported states (for example, Running → Downloading or Stopping → Downloaded), the
  incoming image install's `download progress` percentage and progress bar, and the current → incoming releases.
  Controls continue to address the current install. New target-only services are also visible, including during initial
  deployment; unrelated historical installs are excluded. Missing progress is shown as an indeterminate download rather
  than an invented percentage, and completed updates return to a single state/release.
- Supervisor services (18.2+) also show current and incoming container states, releases, and image download progress.
  The current release is resolved from the reported Supervisor version within the target release's application.
  Host OS updates show the updater's reported stage and `provisioning progress` below Host OS Version; this is coarse
  stage-based progress rather than an image download percentage. Initial provisioning is not shown as an OS update,
  and a reported failure at 100% is displayed as an error. See [OS_AND_SUPERVISOR_UPDATES.md](https://github.com/adhithyananilkumar/vector-balena/blob/master/docs/os-and-supervisor-updates.md).
- Periodic device polling runs only while the browser page is in the foreground. Log polling remains independent at
  approximately two seconds while sources are selected; device refreshes do not reconnect SSH terminals.
- Device field editors initialize their draft and load choices once per opening. Background refreshes continue without
  resetting edits or reloading choices, and failed saves preserve the draft for retry. Reopening an editor uses the
  latest device state.
