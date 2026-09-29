# Edge Delivery Fastly from KV

A [Fastly Compute](https://www.fastly.com/products/edge-compute) service that runs Optimizely Web experiments at
the edge using [`@optimizely/edge-delivery-fastly`](https://www.npmjs.com/package/@optimizely/edge-delivery-fastly).
It reads the Edge Delivery config from a **Fastly KV Store** instead of the Optimizely CDN.

When `kvNamespace` is provided and `DATA` is omitted, the SDK loads the config from KV, using `snippetId` as the
key. If the key is missing, it falls back to the Optimizely CDN, so pages keep working before KV is populated.
An Optimizely webhook keeps KV up to date.

This is the Fastly counterpart of the Cloudflare [`edge-delivery-from-kv`](../edge-delivery-from-kv) template.

> **New to Fastly Compute?** Creating the service, the `origin` backend, domain, TLS and DNS is the same as for
> the starter template. See [`../edge-delivery-fastly-starter/SETUP.md`](../edge-delivery-fastly-starter/SETUP.md).
> This README covers the KV Store and webhook parts. The [`Makefile`](./Makefile) wraps every step (`make help`).

## Prerequisites

- Everything in the starter's [prerequisites](../edge-delivery-fastly-starter/SETUP.md#1-prerequisites): a
  Fastly account with Compute and dynamic backends, an API token, Node.js 20.19+, and GitHub Packages access for
  `@optimizely/*`.
- **KV Store** and **Secret Store** available on the Fastly account. If `npx fastly kv-store list` returns
  `403 Forbidden`, your token lacks the scope, or the product isn't enabled for the account. Ask your Fastly
  admin or Fastly support.

## Configuration

| Name | Kind | Description |
| --- | --- | --- |
| `SNIPPET_ID` | Config Store `edge_delivery_kv` | The snippet to execute. Also the KV key the config is read from and written to. |
| `environment` | Config Store `edge_delivery_kv` | `'dev'` or `'prod'`. `dev` enables `dev_host`. |
| `dev_host` | Config Store `edge_delivery_kv` | The host to proxy when developing locally. |
| `edge_delivery_configs` | KV Store | The Edge Delivery config JSON, keyed by `SNIPPET_ID`. |
| `WEBHOOK_SECRET` | Secret Store `edge_delivery_secrets` | Verifies incoming Optimizely webhooks. Optional; without it, webhook POSTs are rejected. |
| `origin` | Backend | The site you run experiments on (see the [starter's backend notes](../edge-delivery-fastly-starter/SETUP.md#6-backends)). |

All of these are declared in [`fastly.toml`](./fastly.toml):

- **Locally:** the `[local_server]` section.
- **In production:** the `[setup]` section, which the first deploy uses to create the backend and the three
  stores and link them to the service.

The full list of SDK options is documented on the
[npm package page](https://www.npmjs.com/package/@optimizely/edge-delivery).

## How the config gets into KV

- **Local dev:** `fastly.toml` seeds the local KV Store from [`src/seed-data.json`](./src/seed-data.json) under the
  `SNIPPET_ID` key. Replace the file with your own snippet's config, and update the `key` to match. No seeding
  code is needed.
- **Production:** an Optimizely webhook keeps KV up to date automatically (recommended; see below). You can also
  upload a config at any time:

  ```bash
  make kv-put SNIPPET_ID=<snippet-id> FILE=./src/seed-data.json
  make kv-get SNIPPET_ID=<snippet-id>
  ```

Fastly KV writes can take up to a minute to reach every POP. Until then, some locations serve the previous config.

## Auto-updating KV with an Optimizely webhook (recommended)

Instead of pushing config to KV by hand, let Optimizely notify the service whenever the Web SDK artifact changes.
The SDK does the work inside `applyExperiments`, so there's no extra routing in [`src/index.js`](./src/index.js).
When a webhook `POST` arrives (identified by the `X-Optimizely-Event-Type: WebSDKArtifactUpload` header), the SDK:

1. Verifies the `X-Hub-Signature` header against `WEBHOOK_SECRET`.
2. Writes the new config to KV.

To set it up:

1. **Deploy the service** (`make deploy`) and note its public URL, for example `https://your-site.com/` or
   `https://<name>.edgecompute.app/`. Optimizely posts to the service's normal URL; there is no special webhook
   path.
2. **Create the webhook in your Optimizely Web project's webhook settings.** Enter the URL from step 1 as the
   destination. Save it, then **copy the webhook secret** that Optimizely displays.
3. **Store that secret in the Secret Store.** Paste the value when prompted. Don't put it in `fastly.toml`.

   ```bash
   make secret-set
   ```

   Secret changes are live immediately; no activation is needed.
4. **Test it**, optionally, with a signed request of your own:

   ```bash
   make webhook-test URL=https://<your-service-url>/ SECRET=<the-secret>
   # 200 Successfully updated key: <snippet-id>
   ```

After that, publishing changes in Optimizely triggers the webhook, KV is refreshed, and page requests serve the
updated config.

## Run locally

```bash
make npm-auth     # once: npm access to @optimizely/* on GitHub Packages
make install
make serve        # http://127.0.0.1:7676, KV seeded from src/seed-data.json
```

In another terminal, you can send a signed webhook to the local server. It uses the local secret from
`fastly.toml`:

```bash
make webhook-test                  # 200 Successfully updated key: 21617700362
make webhook-test SECRET=wrong     # 401 Invalid signature
```

## Deploy

1. In the `[setup]` section of `fastly.toml`, set the origin `address` and `SNIPPET_ID`.
2. Log in and publish:

   ```bash
   make login
   make deploy       # first run: creates the service, origin backend, Config Store, KV Store and Secret Store
   ```

3. Set up the webhook (above), or upload a config with `make kv-put`.
4. Add your domain, TLS and DNS as described in the [starter's setup guide](../edge-delivery-fastly-starter/SETUP.md#8-domain-tls-and-dns).

To create the stores yourself instead of through `[setup]`, for example on an existing service:

```bash
make config-store && make config-set KEY=SNIPPET_ID VALUE=<snippet-id> && make config-set KEY=environment VALUE=prod
make kv-store
make secret-store && make secret-set
make activate     # links to new stores take effect on activation
```

## Make targets

Run `make help`. In addition to the [starter's targets](../edge-delivery-fastly-starter/SETUP.md#make-targets):

| Target | Description |
| --- | --- |
| `kv-store` | Create the `edge_delivery_configs` KV Store and link it to the service |
| `kv-put SNIPPET_ID=<id> [FILE=...]` | Upload a config to KV |
| `kv-get SNIPPET_ID=<id>` / `kv-list` | Show a stored config / list keys |
| `secret-store` | Create the `edge_delivery_secrets` Secret Store and link it to the service |
| `secret-set` | Set `WEBHOOK_SECRET` (prompts for the value) |
| `webhook-test [URL=...] [SECRET=...] [FILE=...]` | Send a signed Optimizely webhook POST |
