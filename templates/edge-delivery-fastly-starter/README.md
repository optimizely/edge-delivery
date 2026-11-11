# Edge Delivery Fastly Starter

A minimal [Fastly Compute](https://www.fastly.com/products/edge-compute) service that runs Optimizely Web
experiments at the edge using
[`@optimizely/edge-delivery-fastly`](https://www.npmjs.com/package/@optimizely/edge-delivery-fastly).
The config is fetched from the Optimizely CDN using your `snippetId`.

> **Setting up from scratch?** [`SETUP.md`](./SETUP.md) walks through creating the Fastly service, backends,
> Config Store, domain and TLS. The [`Makefile`](./Makefile) wraps each step (`make help`).

## Prerequisites

- A [Fastly account](https://www.fastly.com/signup) with Compute and dynamic backends enabled.
- Node.js 20.19 or later. The [Fastly CLI](https://www.fastly.com/documentation/reference/cli/) is installed as a dev dependency.

## Configuration

Settings live in [`fastly.toml`](./fastly.toml) and are read from the `edge_delivery` Config Store:

| Key           | Required | Description                                                             |
| ------------- | -------- | ----------------------------------------------------------------------- |
| `SNIPPET_ID`  | yes      | The Optimizely snippet whose Edge Delivery config should be executed.   |
| `environment` | yes      | `'dev'` or `'prod'`. `dev` enables the `dev_host` target below.         |
| `dev_host`    | no       | The host to proxy when developing locally.                              |

- **Local development** uses `[local_server.config_stores]` and `[local_server.backends]`.
- **Production** uses `[setup]`: `fastly compute publish` creates the Config Store and the `origin` backend on the
  first deploy. After that, change values in the Fastly UI or with `fastly config-store-entry update`.

The `origin` backend is the site you run experiments on. Its name is passed to the SDK as `originBackend` in
[`src/index.js`](./src/index.js).

The Optimizely hosts (`cdn.optimizely.com` for the config and `logx.optimizely.com` for tracking) are
reached through dynamic backends, so no backend setup is needed for them.

The full list of SDK options is documented on the
[npm package page](https://www.npmjs.com/package/@optimizely/edge-delivery). Uncomment the examples in
[`src/index.js`](./src/index.js) to enable more of them.

## Run locally

```bash
npm install
npm run dev
```

This proxies `dev_host` on http://127.0.0.1:7676 and executes the experiment for `SNIPPET_ID`. Edit the values in
`fastly.toml` to point at your own snippet and site, then re-run `npm run dev`.

## Deploy

1. In the `[setup]` section of `fastly.toml`, set the origin `address` and `SNIPPET_ID`.
2. Log in and publish:

   ```bash
   npx fastly profile create
   npm run deploy
   ```

3. Add your website's domain to the service and point its DNS at Fastly. Then visit the site in a browser.
