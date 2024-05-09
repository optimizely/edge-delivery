<h1 align="center">Optimizely Edge Delivery SDK</h1>

<p align="center">
  Optimizely Edge Delivery lets you execute Optimizely Web experiments on Cloudflare Workers.
  <br>
</p>

<hr>

## Prequisites

- You must have a [Cloudflare Account](https://dash.cloudflare.com/sign-up/workers-and-pages).
- You must install the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/).

## Quick Start

#TODO: turn this into a cloudflare worker template instead

To get started quickly with a new project:
1. Clone this repository and navigate to the templates/edge-delivery-starter directory
    ```bash
    cd templates/edge-delivery-starter
    ```
1. Install requirements 
    ```bash
    npm install
    ```
1. Run the worker locally
    ```bash
    npm run dev 
    ```

    This will open your worker executing in a browser. This loads the website https://example.com/ and executes an experiment that modifies the `h1` header text on the edge. 

1.  Modify the `SNIPPET_ID` and `DEV_URL` environment variables in the in the [wrangler.toml file](./templates/edge-delivery-starter/wrangler.toml). In this project, these are set to an example Optimizely Web Experiment by default. Modify these to your to test an Optimizely Web Experiment against your own website. 
    - Run `npm run dev` again to test the changes.
1. Log in to your Cloudflare account using OAuth
    ```bash
    wrangler login
    ``` 
1. Deploy the worker to your Cloudflare account:
    ```bash
    npm run deploy
    ```
1. On Cloudflare, add a route for your worker for the target website you want to proxy 
    - Alternatively, you can do this by [adding a route to the wrangler.toml](https://developers.cloudflare.com/workers/configuration/routing/routes/#set-up-a-route-in-wranglertoml) before running `npm run deploy`.
1. Navigate to your website in a browser, and see your experiments in action!


## Implementing in an existing Worker

You can install the Optimizely Edge Delivery SDK in any existing Cloudflare Worker, whether you already route your incoming traffic through a Cloudflare Worker, or you'd prefer to start from scratch using Cloudflare's [getting started guide](https://developers.cloudflare.com/workers/get-started/guide/).

### Installing the Edge Delivery SDK

To install the Edge Delivery library, download the [optimizely-edge-delivery-0.0.5-dev-3.tgz file](https://github.com/optimizely/web-sdk/raw/mwh/cjs-7847/public-dist/optimizely-edge-delivery-0.0.5-dev-3.tgz), and install using npm:

`npm install path/to/optimizely-edge-delivery-0.0.5-dev-3.tgz`

### Implementing and executing experiments

The SDK requires a Snippet ID (`snippetId`) to know which configuration file to retrieve to execute your experiments.

#### Basic configuration options

It's recommended to set a Development URL (`devUrl`) for the SDK to use as a target when testing locally or at your worker site directly.

```typescript
const options = {
    "snippetId": "29061560280",
    "devUrl": "https://example.com/"
};
```

#### applyExperiments

The `applyExperiments` method is used to execute experiments. This method uses the request information to make experiment bucketing decisions and apply active experiment variations to the control. Any decisions or changes that cannot be made on the edge are packaged together and added to the `<head>` element for execution on the browser.

```typescript
import { applyExperiments } from '@optimizely/edge-delivery';
...
await applyExperiments(targetRequest, control.clone(), ctx, options);
```
