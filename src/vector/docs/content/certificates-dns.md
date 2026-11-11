# Certificates and DNS

Almost every "it does not connect" problem comes from one of two things: a name that does not resolve, or a certificate that is not trusted. This page covers both, for your computer and for the devices.

## DNS: names that must resolve

Everything must resolve from three places: your **computer**, the **server itself**, and every **device**.

| Name | Used for |
|---|---|
| `api.mydomain.com` | API and login |
| `registry2.mydomain.com` | Container images |
| `cloudlink.mydomain.com` | The VPN that keeps devices connected |
| `logs.mydomain.com` | Device logs |
| `s3.mydomain.com` | Storage |
| `tunnel.mydomain.com` | Remote access |
| `ca.mydomain.com` | Certificate authority files |
| `ocsp.mydomain.com` | Certificate status |
| `vector.mydomain.com` | The Vector server (API behind this UI). Served by the stack's haproxy with the same certificate. |
| `admin.mydomain.com` | The Vector UI (your choice of name). It is a static site hosted elsewhere, for example Vercel, so its record points at that host, not at the server. |

If the domain is on Cloudflare, create the records for the server as **DNS only** (grey cloud). A single wildcard record (`*.mydomain.com`, or `*.fleet.mydomain.com` when the server uses a sub-domain as its domain) covers all of the names above.

Check from any machine:

```bash
nslookup api.mydomain.com
nslookup registry2.mydomain.com
curl https://api.mydomain.com/ping
```

```powershell
Resolve-DnsName api.mydomain.com
Test-NetConnection registry2.mydomain.com -Port 443
```

### Private networks

If the server is on a private network, create the records on your own DNS (router, Pi-hole, dnsmasq) and make sure **devices use it**.

> [!WARNING]
> balenaOS adds `8.8.8.8` as a fallback resolver. Public DNS answers "no such name" for a private domain, and the device may accept that answer, so lookups fail now and then even though your DNS is right. Set your own resolver in the device configuration, for example `"dnsServers": "192.168.1.1"` in `config.json`, or use a public domain that `8.8.8.8` can also resolve.

## Certificates: three choices

### 1. Self-signed (default, for testing)

`make up` creates a private certificate authority. Computers and devices must be told to trust it. It is fine for a lab, but you must install the CA everywhere.

The CA file is `.balena/ca-mydomain.com.pem` on the server.

Devices get it automatically: Vector's Add device page writes it into `config.json` as `balenaRootCA`.

### 2. Automatic (Let's Encrypt, recommended)

If your DNS is on **Cloudflare** or **Gandi**, the server can obtain a trusted certificate by itself using the ACME DNS-01 challenge.

```bash
export ACME_EMAIL=acme@mydomain.com
export CLOUDFLARE_API_TOKEN=<token with DNS write access>
make auto-pki
make verify
```

For Gandi use `GANDI_API_TOKEN` instead. Only one of the two may be set.

On Cloudflare, create the token under My Profile > API Tokens with the "Edit zone DNS" template, limit it to your zone and add **Zone: Read**. The server asks for one wildcard certificate (`*.mydomain.com`), so if the domain has `CAA` records they must allow `letsencrypt.org` for `issuewild`. The first issue takes a few minutes: the server waits for DNS to propagate and then generates DH parameters, and `haproxy` keeps restarting until the certificate files exist.

> [!NOTE]
> The certificate manager's logs include the new private key. Do not paste them into tickets or chats.

The Vector server at `vector.mydomain.com` uses the same wildcard certificate, which is what lets a UI on Vercel (HTTPS) call it.

With a trusted certificate you can drop the CA from your computers, from Docker, and from device configs.

### 3. Your own certificate

Use a wildcard certificate that covers `*.mydomain.com`. Base64-encode the files and set them on the server:

```bash
export HAPROXY_CRT="$(base64 -w0 fullchain.pem)"
export ROOT_CA="$(base64 -w0 intermediates.pem)"
export HAPROXY_KEY="$(base64 -w0 privkey.pem)"
make pki-custom
make verify
```

## Trust the CA on your computer

Needed only with a self-signed certificate. Do all three if you deploy from this computer:

1. **The CLI:** set `NODE_EXTRA_CA_CERTS` to the CA file.
2. **Docker:** add the CA to the system store and restart Docker.
3. **Your browser:** import the CA, or you will see a warning on the UI.

The exact commands are in [Connect the CLI to Vector](doc:connect-cli#2-trust-your-certificate-authority).

## Trust the CA on a device

Done through `config.json`:

```json
{
  "apiEndpoint": "https://api.mydomain.com",
  "vpnEndpoint": "cloudlink.mydomain.com",
  "registryEndpoint": "registry2.mydomain.com",
  "balenaRootCA": "<base64 of your CA>"
}
```

Without `balenaRootCA`, every HTTPS call from a device fails.

## Time must be right

Certificates are only valid at certain times. Devices without a battery clock, such as the Raspberry Pi, start with the wrong date until they get the time over the network. If the network blocks NTP, TLS fails. Allow NTP (UDP 123), or set a time source in `config.json`:

```json
{ "ntpServers": "time.cloudflare.com" }
```

## Firewall

| Port | Direction | Why |
|---|---|---|
| 443/tcp | devices and users to server | API, registry, VPN, UI |
| 123/udp | devices to the internet | Time |
| 22/tcp | you to server | Administration only |

Do not expose PostgREST, the database or S3 admin ports to the internet.
