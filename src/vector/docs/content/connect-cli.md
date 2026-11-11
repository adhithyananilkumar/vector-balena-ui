# Connect the CLI to Vector

A fresh balena CLI talks to balenaCloud. Three things make it talk to your Vector server instead: the server URL, trust for your certificate authority, and a login.

## 1. Set the server URL

This page fills in your server's domain automatically (taken from the API address this UI is configured with). If you still see `mydomain.com`, replace it with the domain of your Vector server, the same domain that `api.mydomain.com` belongs to.

**For the current terminal only:**

```bash
export BALENARC_BALENA_URL=mydomain.com
```

```powershell
$env:BALENARC_BALENA_URL = "mydomain.com"
```

**Permanently**, using the CLI's configuration file. Create it if it does not exist and add one line:

```yaml
balenaUrl: 'mydomain.com'
```

| System | File location |
|---|---|
| Linux, macOS | `~/.balenarc.yml` |
| Windows | `%UserProfile%\_balenarc.yml` |

On Windows you can also set the variable permanently for your user:

```powershell
setx BALENARC_BALENA_URL "mydomain.com"
```

Open a new terminal afterwards. `setx` does not change the window you ran it in.

## 2. Trust your certificate authority

A default Vector install uses a **self-signed** certificate. Your computer does not trust it until you tell it to. Skip this step only if your server uses a publicly trusted certificate (see [Certificates and DNS](doc:certificates-dns)).

First get the CA file. On the server it is at `.balena/ca-mydomain.com.pem` in the `vector-balena` folder (the folder you cloned it into). Copy it to your computer, for example with `scp`:

```bash
scp balena@mydomain.com:~/vector-balena/.balena/ca-mydomain.com.pem ./ca.pem
```

The CLI itself needs `NODE_EXTRA_CA_CERTS`:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/ca.pem
```

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\ca.pem"
```

```powershell
setx NODE_EXTRA_CA_CERTS "C:\path\to\ca.pem"
```

### Docker must trust it too

`balena deploy` pushes images through your local Docker, and Docker has its own list of trusted certificates. If you skip this you will see `x509: certificate signed by unknown authority` while pushing.

**Windows (Docker Desktop):** add the CA to the Windows trusted root store, then restart Docker Desktop (right-click its tray icon, then **Restart**). Run this in an **administrator** PowerShell:

```powershell
certutil -addstore -f "ROOT" C:\path\to\ca.pem
```

**macOS:** add the CA to the system keychain, then restart Docker Desktop:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ca.pem
```

**Linux:** install the CA system-wide and restart Docker:

```bash
sudo cp ca.pem /usr/local/share/ca-certificates/
sudo update-ca-certificates
sudo systemctl restart docker
```

If that is not enough, give Docker the CA for the registry hostname directly:

```bash
sudo mkdir -p /etc/docker/certs.d/registry2.mydomain.com
sudo cp ca.pem /etc/docker/certs.d/registry2.mydomain.com/ca.crt
sudo systemctl restart docker
```

## 3. Log in

```bash
balena login
```

Choose **Credentials**, then enter your email and password. To check where you are logged in:

```bash
balena whoami
```

The output includes the URL. If it says `balena-cloud.com`, your server URL is not set (step 1).

For scripts and CI, log in with an API key instead of a password. See [Automate with CI](doc:ci-automation).

## Check the whole setup

```bash
balena whoami
balena fleets
```

If both work, your computer is ready to deploy. If one fails, see [Troubleshooting](doc:troubleshooting).

> [!TIP]
> The registry hostname is `registry2.mydomain.com`, not `registry`. This is a common source of confusion when you test DNS or write firewall rules.
