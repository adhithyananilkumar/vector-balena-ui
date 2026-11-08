# Access control

Vector decides what each person can see and change using **roles**, **organizations** and **credentials** such as API keys and SSH keys.

## The building blocks

| Item | What it is |
|---|---|
| **Organization** | A group of users, fleets and devices. Administrative scope follows organization membership. |
| **User** | A person who signs in to the UI and the CLI. |
| **Role** | A named set of permissions assigned to users or API keys. |
| **API key** | A credential for scripts and CI. It acts as a user or as a fleet or device. |
| **SSH key** | A public key of a user, used for device SSH access. |

You manage all of these under **Access** in the sidebar. **Roles** and **Permissions** sit under **Static data** and are visible to global administrators only.

## The three kinds of user

### Global administrator (`global-admin`)

Can administer everything, including organizations, roles and global configuration. Even a global administrator cannot read another person's password hash or JWT secret, read another person's API key secret, or read another person's SSH key contents. Passwords and keys can only be changed through the dedicated actions.

### Organization administrator (`organization-admin`)

Can manage the users, fleets, devices and API keys of the organizations they belong to. They cannot create users or organizations, cannot delete whole user records, cannot change roles outside their delegation list, and cannot touch global administrators.

> [!WARNING]
> Organization membership defines the scope. Give `organization-admin` only to people who should administer **every** member and fleet of each organization they belong to.

An organization administrator may assign only the roles listed in `OPEN_BALENA_ORGANIZATION_ADMIN_ASSIGNABLE_ROLES` (comma-separated). If it is empty, they cannot change roles at all. `global-admin` and `organization-admin` can never be delegated.

### Ordinary user

Can read their own user record, organizations, roles, API keys and SSH keys, and can create, edit and delete their own API keys and SSH keys. Nothing else.

## Legacy mode and how to leave it

> [!DANGER]
> Until a role named `global-admin` exists, Vector runs in **legacy mode**: every signed-in user behaves as a full administrator. This keeps old installations working after an upgrade, but it is not safe for production.

To turn on enforcement, bootstrap the first global administrator:

1. Find the numeric `id` of the trusted user (not their email) under **Users**.
2. Set it on the Vector server and restart it:

```bash
OPEN_BALENA_BOOTSTRAP_USER_ID=1
```

3. At startup Vector creates the `global-admin` role and assigns it to that user. Check that it worked.
4. Create a **second** global administrator so you are not locked out.
5. Remove `OPEN_BALENA_BOOTSTRAP_USER_ID` and restart.
6. Create the `organization-admin` role and assign it to the intended people.
7. Sign in as an ordinary user, an organization administrator and a global administrator, and check what each sees.

The setting is safe to leave in place; it repairs a missing role or assignment at every start, but removing it afterwards keeps things tidy.

## Create and use API keys

1. Open **Access**, then **API Keys**, then **Create**.
2. Choose the owner (a user, fleet or device) and the roles.
3. Copy the key when it is shown. It cannot be shown again.

Use it with the CLI in scripts:

```bash
balena login --token <API_KEY>
```

Rules for keys:

- One key per system or pipeline, so each can be revoked alone.
- Give the minimum permissions.
- Delete keys you no longer use.

## Add an SSH key

Open **Access**, then **SSH Keys**, then **Create**, and paste your **public** key (`~/.ssh/id_ed25519.pub`). Never paste a private key.

The browser terminal does not need your key. It uses short-lived keys that Vector creates for you. See [Remote access](doc:remote-access).

## Change a password

Use the user menu in the top right of the UI, then **Change password**. Admins cannot read or set a user's password through generic table edits.

## How the protection works

Operational data goes through the openBalena API and its own permission rules. Identity and permission tables use a same-origin proxy at `/admin-db` which:

- checks your sign-in token;
- works out your role and organization on the server;
- limits every query to your scope;
- refuses queries that try to expand or alias data;
- removes secrets before replying.

This only protects you if PostgREST cannot be reached by browsers. Keep `OPEN_BALENA_POSTGREST_URL` on an internal address and remove public access to PostgREST.

## Checklist for a safe setup

1. `OPEN_BALENA_JWT_SECRET` is set on the Vector server.
2. `OPEN_BALENA_POSTGREST_URL` is internal only.
3. `OPEN_BALENA_BOOTSTRAP_USER_ID` was used, then a second global administrator was added.
4. No public route to PostgREST.
5. Accounts of each kind were tested.
6. Denied `/admin-db` requests are monitored.

If you see `403` or access errors, read [Access and permission errors](doc:troubleshooting#access-and-permission-errors).
