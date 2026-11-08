# Glossary

Short definitions of the terms used in Vector and in these docs.

| Term | Meaning |
|---|---|
| **API key** | A credential for scripts and CI. It can be used instead of a password. |
| **balena CLI** | The command-line tool that builds, deploys and manages. Command name: `balena`. |
| **balenaOS** | The small operating system that runs on each device and runs your containers. |
| **Base image** | An unconfigured balenaOS image for one device type and version, downloaded once and reused. |
| **Build** | Turning your project into container images. With Vector this happens on your own computer. |
| **CA (certificate authority)** | The authority that signs your server's certificates. A self-signed server needs it installed on every computer and device. |
| **`config.json`** | The file on a device's boot partition that says which server to use and who the device is. |
| **Config variable** | A variable starting `RESIN_` or `BALENA_` that changes device or supervisor behaviour. |
| **Container** | A packaged, isolated process. Your app runs as one or more containers. |
| **Deploy** | Build locally, push to the registry, and create a release. |
| **Device** | A computer running balenaOS, registered to your server. |
| **Device type** | The hardware model, for example `raspberrypi4-64`. It decides the CPU architecture. |
| **Draft release** | A release that exists but is not rolled out until finalized. |
| **Environment variable** | A variable passed to your containers. |
| **Finalize** | Make a draft release live. |
| **Fleet** | A group of devices that run the same software and share settings. Older documentation calls it an *application*. |
| **Image** | The file system of a container, stored in the registry. |
| **Local mode** | A development mode that runs code directly on a device on your network. |
| **Organization** | A group of users, fleets and devices. |
| **Pin** | Hold a device or fleet on one release instead of following the latest. |
| **PostgREST** | The service that exposes the database as an HTTP API. It must never be public. |
| **Provisioning** | Registering a new device and giving it its configuration. |
| **Provisioning key** | A credential inside a fleet-wide image that lets any device flashed from it register itself. |
| **Registry** | The server that stores container images. Its hostname is `registry2.<domain>`. |
| **Release** | A frozen, versioned snapshot of your software, identified by a commit hash. |
| **Role** | A named set of permissions. |
| **Service** | One container in a multi-container app, defined in `docker-compose.yml`. |
| **Supervisor** | The program on each device that downloads releases and runs the containers. |
| **Tag** | A free label on a fleet, device or release. |
| **Track latest** | The default: a device runs the newest finalized release of its fleet. |
| **UUID** | The unique 32-character identity of a device. The UI shows the first 7 characters. |
| **VPN (cloudlink)** | The permanent connection each device keeps to the server. It carries commands, logs and remote access. |
