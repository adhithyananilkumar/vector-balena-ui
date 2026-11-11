# Connect the CLI to Vector

Four steps, about five minutes. You only do this once per computer. Pick your system, then copy and paste each command exactly as shown.

> [!TIP]
> **Your server address is `mydomain.com`.** This page fills it in for you, so you can paste every command as it is.

## Windows

### 1. Install the balena CLI

Do this first: until it is installed, `balena` gives "not recognized". Open PowerShell (press the **Windows key**, type `PowerShell`, press **Enter**) and paste this whole block, then press Enter. It downloads the official installer and starts it. Click **Next** until it finishes.

```powershell
$r = Invoke-RestMethod https://api.github.com/repos/balena-io/balena-cli/releases/latest
$a = $r.assets | Where-Object { $_.name -like "*windows-x64-installer.exe" }
Invoke-WebRequest $a.browser_download_url -OutFile "$env:TEMPalena-cli-installer.exe"
Start-Process "$env:TEMPalena-cli-installer.exe"
```

Then **close PowerShell and open a new window**, and check it worked:

```powershell
balena version
```

You should see a version number such as `25.2.11`. (Prefer to click? Download the file ending in `-windows-x64-installer.exe` from <https://github.com/balena-io/balena-cli/releases/latest>.)

### 2. Open PowerShell

Press the **Windows key**, type `PowerShell`, and press **Enter**. A blue or black window opens (a new one, if you just installed). This is where you paste commands: **right-click** inside it to paste, then press **Enter**.

### 3. Point the CLI at your server

Paste this and press Enter:

```powershell
setx BALENARC_BALENA_URL "mydomain.com"
```

You should see `SUCCESS`. Now **close the PowerShell window and open a new one** (Windows key, `PowerShell`, Enter). The setting only applies to windows opened afterwards.

### 4. Log in and check

In the new window, paste:

```powershell
balena login
```

Use the arrow keys to choose **Credentials** and press Enter, then type the email and password you use for Vector. Then paste:

```powershell
balena whoami
balena fleets
```

`balena whoami` should show `mydomain.com` as the URL, and `balena fleets` lists your fleets. That is it: you are connected.

## macOS and Linux

1. Install the CLI from <https://github.com/balena-io/balena-cli/releases/latest> (the macOS `.pkg`, or the Linux `.zip` which you unzip and add to your PATH).
2. Open **Terminal** (macOS: press Cmd+Space, type `Terminal`, Enter).
3. Paste this to point the CLI at your server for good, then close and reopen Terminal:

```bash
echo "balenaUrl: 'mydomain.com'" >> ~/.balenarc.yml
```

4. In the new Terminal, log in and check:

```bash
balena login
balena whoami
balena fleets
```

Choose **Credentials** and enter your Vector email and password.

## It did not work?

| You see | Do this |
|---|---|
| `balena` is not recognized / command not found | The CLI is not installed or the window was opened before the install. Close the window, open a new one, try again. |
| `whoami` shows `balena-cloud.com` | Step 3 was not applied. Close all PowerShell windows, open a new one and run `balena login` again. |
| `Invalid credentials` | Use the same email and password you use to sign in to Vector. |
| Anything about a certificate (`self signed`, `x509`, `unable to verify`) | Your server uses its own certificate. See [Self-signed certificates](doc:connect-cli#self-signed-certificates) below. |
| Something else | See [Troubleshooting](doc:troubleshooting). |

For scripts and CI, log in with an API key instead of a password. See [Automate with CI](doc:ci-automation).

## Self-signed certificates

A server with a publicly trusted certificate (the default for a domain set up with Let's Encrypt, see [Certificates and DNS](doc:certificates-dns)) needs none of this. A server with its own certificate authority needs your computer to trust it (only if you saw a certificate error).

**1. Get the CA file** from the server. It is at `.balena/ca-mydomain.com.pem` inside the `vector-balena` folder. Copy it to your computer, for example:

```powershell
scp balena@mydomain.com:~/vector-balena/.balena/ca-mydomain.com.pem $HOME\ca.pem
```

**2. Tell the CLI to trust it** (Windows, then open a new PowerShell):

```powershell
setx NODE_EXTRA_CA_CERTS "$HOME\ca.pem"
```

On macOS and Linux: `export NODE_EXTRA_CA_CERTS=$HOME/ca.pem` (add it to `~/.zshrc` or `~/.bashrc` to keep it).

**3. Tell Docker to trust it**, only needed for `balena deploy`. Otherwise pushing fails with `x509: certificate signed by unknown authority`.

- **Windows:** open PowerShell **as administrator** (Windows key, type `PowerShell`, right-click it, **Run as administrator**), paste the command below, then restart Docker Desktop (right-click its tray icon, **Restart**):

```powershell
certutil -addstore -f "ROOT" $HOME\ca.pem
```

- **macOS:** then restart Docker Desktop:

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/ca.pem
```

- **Linux:**

```bash
sudo cp ~/ca.pem /usr/local/share/ca-certificates/ca.crt
sudo update-ca-certificates
sudo systemctl restart docker
```

> [!TIP]
> The registry hostname is `registry2.mydomain.com`, not `registry`. This is a common source of confusion when you test DNS or write firewall rules.
