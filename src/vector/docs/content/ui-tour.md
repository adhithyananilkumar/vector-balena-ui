# A tour of the interface

Everything in Vector is reachable from the left sidebar and the top bar.

## The top bar

| Control | What it does |
|---|---|
| **Search** (`Ctrl K` or `⌘K`) | Jump to any page, or find a device or fleet by name or UUID. |
| **(i)** next to the page title | Short explanation of the page you are on. |
| **Docs** | Opens this documentation. |
| **Theme** | Switch between light, dark and system. |
| **User menu** | Change your password or log out. |

`Ctrl B` (or `⌘B`) collapses the sidebar into a slim icon rail.

## The sidebar

| Group | Contains |
|---|---|
| **Overview** | Dashboard with fleet and device counts. |
| **Provision** | **Add device** and **Delta builds**. |
| **Fleets** | Fleets, plus their configuration variables, environment variables and tags. |
| **Devices** | Every registered device, with variables and tags. |
| **Images, Releases, Services** | What was built and pushed: releases, the container images in them, and the services they define. |
| **Access** | Organizations, users, API keys and SSH keys. |
| **Static data** | Reference data: device types, CPU architectures, roles and permissions. |

> [!NOTE]
> You only see the groups your role allows. Administrator-only pages such as **Roles** and **Permissions** are hidden from ordinary users. See [Access control](doc:access-control).

## Lists

Every list supports sorting, filtering and pagination. Use the filter controls above the table, and the active filters appear as chips you can remove one by one.

Device lists refresh about every 30 seconds while the tab is open, and rows that are actively updating refresh about once a second.

## The device page

Opening a device shows its dashboard: summary, services, logs, variables, tags and controls. The device page is described in [The device dashboard](doc:device-dashboard).

## Editing and saving

Create and edit forms open as side sheets. A failed save keeps what you typed so you can fix the problem and try again.

Destructive actions, such as deleting a fleet, always ask for confirmation first.
