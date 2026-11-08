# Automate with CI

Instead of deploying from a laptop, a CI job can run `balena deploy` whenever you merge code. The mechanics are the same as [Deploy from your computer](doc:deploy-local); the job just needs the server URL, your CA, and credentials.

## What the CI machine needs

- Docker (any GitHub-hosted Linux runner has it).
- The balena CLI.
- Your server's CA certificate, if you use the self-signed default.
- Network access to `api.mydomain.com` and `registry2.mydomain.com`. Hosted runners need the server to be reachable from the internet.
- Credentials for a **dedicated deploy account**, not a person's login.

## Create credentials

Create a user (or API key) used only for deploying. In the UI see **Access**, then **API Keys**. Give it the least access that can push to the fleet.

```bash
balena login --token <API_KEY>
```

Store the key and the CA as CI secrets. Never put them in the repository.

> [!WARNING]
> An API key can deploy to your fleets. Treat it like a password: store it only as a CI secret, rotate it when people leave, and delete keys you no longer use.

## GitHub Actions example

Save as `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vector
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      BALENARC_BALENA_URL: mydomain.com
      BALENARC_NO_ANALYTICS: '1'
      NODE_EXTRA_CA_CERTS: ${{ github.workspace }}/ca.pem
    steps:
      - uses: actions/checkout@v4

      - name: Write the CA certificate
        run: echo "${{ secrets.VECTOR_CA_PEM }}" > ca.pem

      - name: Trust the CA in Docker
        run: |
          sudo mkdir -p /etc/docker/certs.d/registry2.mydomain.com
          sudo cp ca.pem /etc/docker/certs.d/registry2.mydomain.com/ca.crt

      - name: Install the balena CLI
        run: npm install -g balena-cli --production --unsafe-perm

      - name: Log in
        run: balena login --token "${{ secrets.VECTOR_API_KEY }}"

      - name: Set up emulation for ARM
        uses: docker/setup-qemu-action@v3

      - name: Deploy
        run: balena deploy MyFleet --build --emulated --note "$GITHUB_SHA"
```

Remove `--emulated` and the QEMU step if the runner's CPU matches your fleet.

## Self-hosted runner

If your server is only reachable on a private network, run a self-hosted runner on that network, or on the server itself. That runner then has direct access to the registry and does not need the internet at all.

## Local script alternative

For small teams a script on a shared build PC may be enough. See the PowerShell and bash examples in [Deploy from your computer](doc:deploy-local#a-repeatable-script). Schedule it with Task Scheduler or cron if you want nightly releases.

## Good practice

- Deploy as a **draft** from CI, then finalize after tests pass: `balena deploy MyFleet --build --draft`.
- Tag releases with the commit and version so you can trace a running device back to its source.
- Fail the job on any non-zero exit code; do not ignore errors.
- Keep the CLI version pinned in CI so builds are repeatable.
