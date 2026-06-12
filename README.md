<h1 align="center">Optimizely Edge Delivery SDK</h1>

<p align="center">
  Optimizely Edge Delivery lets you execute Optimizely Web experiments on Cloudflare Workers.
  <br>
</p>

<hr>

This repository contains ready-to-use **Cloudflare Worker templates** for getting started
with Optimizely Edge Delivery.

> **Looking for the SDK reference?** The `@optimizely/edge-delivery` package — including the
> full list of configuration options and the `applyExperiments` API — is documented on the
> [npm package page](https://www.npmjs.com/package/@optimizely/edge-delivery).

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

## Templates

| Template | Description |
| --- | --- |
| [`edge-delivery-starter`](./templates/edge-delivery-starter) | Minimal worker that loads the Edge Delivery config from the Optimizely CDN using your `snippetId`. Start here. |
| [`edge-delivery-from-kv`](./templates/edge-delivery-from-kv) | Loads the config from a Cloudflare KV namespace instead of the CDN — useful when you push config to KV yourself (e.g. via a webhook). |

Each template has its own README with configuration and deployment details.

## Quick start

```bash
# 1. Clone this repository and pick a template
cd templates/edge-delivery-starter

# 2. Install dependencies
npm install

# 3. Run the worker locally
npm run dev
```

This loads the target site (`example.com` by default) and executes an example Optimizely
Web experiment that modifies the page on the edge. Edit the variables in the template's
`wrangler.toml` to point at your own snippet and site.

To deploy:

```bash
wrangler login
npm run deploy
```

Then add a [route](https://developers.cloudflare.com/workers/configuration/routing/routes/)
for your worker on the website you want to run experiments on, and visit it in a browser to
see your experiments in action.

## Using the SDK in an existing Worker

You can also install the SDK directly in any existing Cloudflare Worker:

```bash
npm install @optimizely/edge-delivery@latest
```

```typescript
import { applyExperiments } from '@optimizely/edge-delivery';

export default {
    async fetch(request, ctx, env) {
        const options = {
            snippetId: env.SNIPPET_ID,
            environment: 'prod',
        };
        return await applyExperiments(request, ctx, options);
    },
};
```

See the [npm package page](https://www.npmjs.com/package/@optimizely/edge-delivery) for the
complete list of options (CDN vs. KV config, fallback behavior, snippet injection, caching,
local development, and more).
