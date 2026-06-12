# Edge Delivery Starter

A minimal Cloudflare Worker that runs Optimizely Web experiments at the edge using
[`@optimizely/edge-delivery`](https://www.npmjs.com/package/@optimizely/edge-delivery).
The config is fetched from the Optimizely CDN using your `snippetId`.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

## Configuration

Worker variables live in [`wrangler.toml`](./wrangler.toml), split into a `dev` and a
`prod` environment:

| Variable      | Required | Description                                                              |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `SNIPPET_ID`  | yes      | The Optimizely snippet whose Edge Delivery config should be executed.    |
| `environment` | yes      | `'dev'` or `'prod'`. `dev` enables the `dev_host` target below.          |
| `dev_host`    | no       | The host to proxy when developing locally (defaults to `example.com`).   |

The full list of SDK options is documented on the
[npm package page](https://www.npmjs.com/package/@optimizely/edge-delivery). Uncomment
the examples in [`src/index.ts`](./src/index.ts) to enable more of them.

## Run locally

```bash
npm install
npm run dev
```

This proxies `dev_host` and executes the experiment for `SNIPPET_ID`, modifying the page
on the edge. Edit the variables in `wrangler.toml` to point at your own snippet and site,
then re-run `npm run dev`.

## Deploy

```bash
wrangler login
npm run deploy
```

Then add a [route](https://developers.cloudflare.com/workers/configuration/routing/routes/)
for the worker on the website you want to run experiments on, and visit it in a browser.
