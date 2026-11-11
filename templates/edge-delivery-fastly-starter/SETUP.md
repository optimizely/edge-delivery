# Setting up Edge Delivery on Fastly Compute from scratch

This guide goes from an empty Fastly account to a live Compute service that runs Optimizely Web experiments
on your site. Every step has a `make` target (see the [`Makefile`](./Makefile); run `make help`). The raw
Fastly CLI commands are shown too.

- [How it works](#how-it-works)
- [1. Prerequisites](#1-prerequisites)
- [2. Install dependencies](#2-install-dependencies)
- [3. Authenticate the Fastly CLI](#3-authenticate-the-fastly-cli)
- [4. Run locally](#4-run-locally)
- [5. Create the Compute service](#5-create-the-compute-service)
- [6. Backends](#6-backends)
- [7. Configuration (Config Store)](#7-configuration-config-store)
- [8. Domain, TLS and DNS](#8-domain-tls-and-dns)
- [9. Verify](#9-verify)
- [Troubleshooting](#troubleshooting)
- [Make targets](#make-targets)

## How it works

```
Browser ──► Fastly Compute service (this template)
               │
               ├─► origin backend (named)        your site: the page to experiment on
               ├─► cdn.optimizely.com (dynamic)  Edge Delivery datafile for your snippet
               └─► logx.optimizely.com (dynamic) tracking events (snippetless mode only)
```

For each HTML request, the service does the following:

1. Fetches the page from your origin and the datafile from the Optimizely CDN.
2. Buckets the visitor into experiments.
3. Rewrites the HTML at the edge.
4. Injects the browser JS that handles any remaining changes.

The Edge Delivery library makes these fetches without a backend name. `@optimizely/edge-delivery-fastly` routes
them for you:

| Request to | Sent through |
| --- | --- |
| Any non-Optimizely host (your origin) | The named backend you pass as `originBackend` (`origin` in [`src/index.js`](./src/index.js)) |
| `*.optimizely.com`, `optimizely-staging.s3.amazonaws.com` | Dynamic backends, created on the fly by Compute |

## 1. Prerequisites

| Requirement | Why |
| --- | --- |
| A [Fastly account](https://www.fastly.com/signup) with **Compute** | The service runs on Compute. |
| **Dynamic backends** available on the account | Reaching `cdn.optimizely.com` and `logx.optimizely.com`. They are available on Compute by default; on a free account you may need to [ask Fastly support](https://www.fastly.com/documentation/guides/integrations/backends/) to enable them. |
| A Fastly **API token** with `global` scope | Creating and publishing the service from the CLI. Create one under **Account → API tokens**. |
| **Node.js 20.19+** | Building the Wasm package. The Fastly CLI is installed as a dev dependency (`npx fastly`). |
| A GitHub token with **`read:packages`** | `@optimizely/edge-delivery-fastly` and `@optimizely/edge-delivery` are installed from GitHub Packages. With the `gh` CLI: `gh auth refresh -s read:packages`. |
| Your Optimizely **snippet ID** | The Edge Delivery datafile is published per snippet. |
| Your site's **origin hostname** | It must reach your origin server directly, not resolve back to Fastly. See [section 6](#6-backends). |

## 2. Install dependencies

Point the `@optimizely` scope at GitHub Packages. This writes your user-level `~/.npmrc`, so it isn't committed:

```bash
make npm-auth     # npm config set @optimizely:registry https://npm.pkg.github.com
                  # npm config set //npm.pkg.github.com/:_authToken $(gh auth token)
make install      # npm install
```

## 3. Authenticate the Fastly CLI

```bash
make login        # npx fastly auth login  (paste the API token)
make whoami       # confirm the account
```

In CI, set `FASTLY_API_TOKEN` instead.

## 4. Run locally

```bash
make serve        # npx fastly compute serve → http://127.0.0.1:7676
```

The local server (Viceroy) reads the `[local_server]` section of [`fastly.toml`](./fastly.toml):

- `[local_server.backends.origin]`: the site to proxy.
- `[local_server.config_stores.edge_delivery]`: the local `SNIPPET_ID`, `environment` and `dev_host`.

With `environment = "dev"`, the library rewrites request URLs to `dev_host`, so `http://127.0.0.1:7676/about`
fetches `https://<dev_host>/about` through the `origin` backend.

The Optimizely hosts don't need entries here. Viceroy creates dynamic backends for them just as Compute does.

## 5. Create the Compute service

### Option A: first deploy creates everything (recommended)

1. Edit the `[setup]` section of [`fastly.toml`](./fastly.toml):
   - `setup.backends.origin.address`: your origin hostname.
   - `setup.config_stores.edge_delivery.items.SNIPPET_ID`: your snippet ID.
   - Keep `environment = "prod"`.
2. Publish:

   ```bash
   make deploy       # npx fastly compute publish
   ```

On the first run there is no `service_id` in `fastly.toml`, so the CLI does the following:

1. Offers to create a new Compute service.
2. Creates the `origin` backend and the `edge_delivery` Config Store from `[setup]`, and links the store to the service.
3. Creates a default `<random-name>.edgecompute.app` domain.
4. Uploads the package and activates the version.
5. Writes `service_id` into `fastly.toml`.

Commit that change, so later `make` targets and deploys use the same service.

`[setup]` is only read when the service is created. After that, change backends and config with the targets
below, or in the Fastly UI.

### Option B: create each piece yourself

Use this to attach to an existing service or script the setup. Each command edits the latest service version
(cloned if needed).

```bash
make create-service SERVICE_NAME=my-edge-delivery   # npx fastly service create --type wasm --name ...
# Add the printed ID to fastly.toml:  service_id = "<id>"

make backend ORIGIN=origin.example.com              # the named `origin` backend (section 6)
make config-store                                    # create + link the edge_delivery store
make config-set KEY=SNIPPET_ID VALUE=<snippet-id>
make config-set KEY=environment VALUE=prod
make domain DOMAIN=www.example.com                   # or use the edgecompute.app domain from publish
make deploy                                          # upload the Wasm package
make activate                                        # activate the latest version
```

## 6. Backends

| Backend | Used for | Type | Required setup |
| --- | --- | --- | --- |
| `origin` | Your pages. Every experiment starts from the origin's HTML. | Named | Create it (`make backend ORIGIN=...` or `[setup]`). The name must match `originBackend` in `src/index.js`. |
| `cdn.optimizely.com` | The Edge Delivery datafile (`/js/web_sdk_v0_<snippet>.json`) | Dynamic | None. Dynamic backends must be available (see [prerequisites](#1-prerequisites)). |
| `logx.optimizely.com` | Tracking events, sent only when `isSnippetless: true` | Dynamic | None |
| `optimizely-staging.s3.amazonaws.com` | The datafile when `isProd: false` | Dynamic | None |

The browser loads scripts such as the Optimizely snippet and jQuery from `cdn.optimizely.com` and
`cdn-pci.optimizely.com` directly. They don't need backends.

The origin backend is the one that needs care:

- **TLS.** Create it with TLS, SNI and a certificate-hostname check (`make backend` does this):

  ```bash
  npx fastly service backend create --service-id <id> --version latest --autoclone \
    --name origin --address origin.example.com --port 443 \
    --use-ssl --ssl-sni-hostname origin.example.com --ssl-cert-hostname origin.example.com
  ```

- **Don't point it at your public hostname once DNS points to Fastly.** If `www.example.com` is served by this
  service, the origin backend must be the server behind it, such as `origin.example.com`, a load balancer
  hostname or an IP. Otherwise requests loop through Fastly.
- **Host header.** Origin requests keep the URL's host. In production that is the visitor-facing hostname, for
  example `www.example.com`. If your origin only answers to its own hostname, add
  `--override-host origin.example.com` to the backend.
- **Compression.** The package asks the origin for gzip and Fastly decompresses it, so the HTML can be rewritten.
  No configuration is needed.
- **Why a named backend.** Without `originBackend`, the origin fetch goes through a dynamic backend to the
  request's own host, which is this service, and loops.

Test the backend and check it's on the active version:

```bash
make backends     # npx fastly service backend list --service-id <id> --version active
```

## 7. Configuration (Config Store)

[`src/index.js`](./src/index.js) reads its settings from the `edge_delivery` Config Store:

| Key | Required | Value |
| --- | --- | --- |
| `SNIPPET_ID` | yes | Your Optimizely snippet ID |
| `environment` | yes | `prod` in production. `dev` rewrites requests to `dev_host` and is meant for local development. |
| `dev_host` | no | The host to proxy when `environment` is `dev` |

```bash
make config-list
make config-set KEY=SNIPPET_ID VALUE=<snippet-id>
```

Config Store updates take effect within seconds and don't need a new version or activation. Creating the store
and linking it to a service does need an activation.

To pass more SDK options, such as `accountId`, `fallback` or `cacheTTLs`, edit `src/index.js`, or read more keys
from the store the same way.

## 8. Domain, TLS and DNS

1. **Test on the default domain first.** Publishing creates `<name>.edgecompute.app`. It has TLS already and
   is good for testing. Its `Host` differs from your site's, so if your origin checks `Host`, test with
   `--override-host` on the backend.
2. **Add your domain**, then activate:

   ```bash
   make domain DOMAIN=www.example.com && make activate
   ```

3. **Get a certificate** for it with Fastly TLS:

   ```bash
   npx fastly tls-subscription create --domain www.example.com
   ```

   Complete the DNS challenge the command, or **Secure → TLS management** in the UI, asks for.
4. **Point DNS at Fastly.** Create the CNAME (or A records for an apex domain) that Fastly shows for the TLS
   subscription. Before switching DNS, make sure the `origin` backend no longer uses this hostname
   ([section 6](#6-backends)).

## 9. Verify

```bash
curl -sI https://<your-service>.edgecompute.app/ | grep -i set-cookie
```

A working setup returns the origin page with Optimizely cookies added: `optimizelyEndUserId`,
`optimizelySession`, and the `OPTY$$…` sticky-bucketing cookies.

Also check:

- **Edge logs.** Run `make logs` and load a page. To get detailed logs, set `logLevel: 'debug'` in
  `src/index.js`, then redeploy. The logs should show `Getting data manifest from … web_sdk_v0_<snippet>.json`
  and `Browser JS added`.
- **Browser logs.** Add `?optimizely_log=debug` to a page URL to see Edge Delivery logs in the browser console.
- **Versions.** Run `make versions` to confirm the latest version is active.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm install` fails with `E401` / `E404` on `@optimizely/*` | npm is not authenticated to GitHub Packages | `gh auth refresh -s read:packages && make npm-auth` |
| 500 response; logs show a backend error for `origin` | No backend named `origin` on the active version, or its name differs from `originBackend` | `make backends`; `make backend ORIGIN=...`; `make activate` |
| Datafile fetch fails (`DNS resolution or network error fetching manifest`) | Dynamic backends not available on the account | Ask Fastly support to enable dynamic backends |
| Requests time out or loop | The `origin` backend points to a hostname that resolves to this Fastly service | Point it at the real origin ([section 6](#6-backends)) |
| Origin returns 403 or the wrong site | The origin expects a different `Host` | Add `--override-host <origin-host>` to the backend |
| Page loads but no experiments run | Wrong `SNIPPET_ID`, or Edge Delivery not enabled for the snippet | `make config-list`; check the datafile URL in the logs returns 200 |
| Changes to `fastly.toml` `[setup]` have no effect | `[setup]` is only used when the service is first created | Use `make backend`, `make config-set` or the UI |

## Make targets

```
make help
```

| Target | Description |
| --- | --- |
| `npm-auth` | Authenticate npm to GitHub Packages for `@optimizely/*` (uses the `gh` CLI token) |
| `install` | `npm install` |
| `build` | Compile `src/index.js` to `bin/main.wasm` |
| `serve` | Run locally on http://127.0.0.1:7676 |
| `login` / `whoami` | Store and check the Fastly API token |
| `deploy` | Build and publish. The first run creates the service from `[setup]` |
| `activate [VERSION=n]` | Activate a version (default: latest) |
| `versions` | List service versions |
| `logs` | Tail live logs |
| `create-service [SERVICE_NAME=...]` | Create an empty Compute service |
| `backend ORIGIN=<host> [NAME=origin]` | Add a TLS origin backend |
| `backends` | List backends on the active version |
| `domain DOMAIN=<host>` / `domains` | Add or list domains |
| `config-store` | Create the `edge_delivery` Config Store and link it to the service |
| `config-set KEY=... VALUE=...` / `config-list` | Set or list config values |

Targets that need the service read `service_id` from `fastly.toml`. Pass `SERVICE_ID=<id>` to override it.
