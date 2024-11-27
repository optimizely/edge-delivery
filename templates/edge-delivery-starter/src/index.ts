/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { applyExperiments, Options } from '@optimizely/edge-delivery';

interface Env {
    SNIPPET_ID: string;
    environment: 'dev' | 'prod'
    dev_host?: string;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return await handleRequest(request, env, ctx);
    },
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
    // Configure all the options to pass to Optimizely
    const options: Options = {
        "snippetId": env.SNIPPET_ID,
        environment: env.environment,
        dev_host: env.dev_host
    };

    // Make experiment decisions based on the request information
    // Apply those changes to the control
    // Any decisions or changes that cannot be made here are packaged together
    // and added to the <head> element for execution on the browser
    return await applyExperiments(request, ctx, options);
}
