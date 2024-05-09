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

import { applyExperiments } from '@optimizely/edge-delivery';

interface Env {
    SNIPPET_ID: string;
    DEV_URL: string;
}
 
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return await handleRequest(request, env, ctx);
    },
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
    let requestUrl = new URL(request.url);

    let control;
    let targetUrl;
    let targetRequest : Request;

    // TODO: Move this logic to the web sdk with a configuration option 
    if (requestUrl.host.includes("localhost") || 
            (requestUrl.host.startsWith('edge-delivery-starter') && requestUrl.host.endsWith('workers.dev'))) {
        targetUrl = env.DEV_URL;
        targetRequest = new Request(targetUrl, request);
        control = await fetch(targetUrl, targetRequest);
    } else {
        targetUrl = requestUrl;
        targetRequest = request;
        control = await fetch(request);
    }

    // TODO: Remove try/catch and put safeguards in applyExperiments
    try {
        // Configure all the options to pass to Optimizely
        const options = {
            "snippetId": env.SNIPPET_ID,
        };

        // Make experiment decisions based on the request information
        // Apply those changes to the control
        // Any decisions or changes that cannot be made here are packaged together 
        // and added to the <head> element for execution on the browser 
        const treatedControl = await applyExperiments(targetRequest, control.clone(), ctx, options);

        return treatedControl;

    } catch (e) {
        // If an error occurs, or if a timeout occurs, etc., bail and don't apply experiments
        console.log("An error occurred, returning Control instead", e);
    }

    return control;
}
