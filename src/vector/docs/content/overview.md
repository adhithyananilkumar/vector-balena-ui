# Welcome to Vector

Vector is Protoform's fleet management platform. You use it to put software on many devices, keep it up to date, and reach any device remotely, all from servers you run yourself.

This documentation covers the whole workflow: running the server, building and deploying software, provisioning devices, managing them, and fixing problems.

## How the pieces fit together

Vector has three parts, and it helps to know which one does what.

| Part | What it does | Where it runs |
|---|---|---|
| **Vector server** (openBalena) | Stores fleets, releases and devices. Hosts the API, the container registry, the VPN that devices keep open, and the log service. | Your server or cloud VM |
| **Vector UI** (this app) | The web interface for everything the server knows about. Also builds device images and gives you a browser terminal. | Next to the server |
| **balena CLI** | The command-line tool that **builds your software and pushes it to the server**. | Your own computer or a CI machine |
| **Devices** | Run balenaOS. Each one keeps a connection to the server, pulls new releases from the registry, and runs them. | Out in the field |

> [!NOTE]
> Vector does **not** build your software on the server. You build on your own machine (or in CI) with `balena deploy`, and the finished images are pushed to the server's registry. The server then distributes them to your devices. This is the workflow most of this documentation describes.

## The life of an update

1. You change your code on your computer.
2. You run `balena deploy <fleet>`. Docker builds the images locally.
3. The CLI pushes the images to the registry on your Vector server and creates a **release**.
4. Every device in that fleet is told a new release exists.
5. Each device downloads the images and swaps the old containers for the new ones.
6. You watch progress in the UI under **Devices**.

## Where to go next

- New here? Follow the [Quick start](doc:quick-start) to get from nothing to a running deployment.
- Want to deploy from your own machine? Read [Deploy from your computer](doc:deploy-local).
- Something is broken? Open [Troubleshooting](doc:troubleshooting).
- Need a command? See the [CLI cheat sheet](doc:cli-cheatsheet).
- New to the terms? See the [Glossary](doc:glossary).

## Conventions in these docs

Commands appear in code blocks with a **Copy** button. Replace placeholders such as `mydomain.com`, `MyFleet` and `<uuid>` with your own values.

Where a command differs by operating system, there is one block for **bash** (Linux and macOS) and one for **PowerShell** (Windows).
