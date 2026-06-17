/**
 * Optimizely Edge Delivery — starter template.
 *
 * - Run `npm run dev` to start a local development server.
 * - Open http://localhost:8787/ to see the worker in action.
 * - Run `npm run deploy` to publish the worker.
 * - Regenerate `Env` types after editing bindings with `npm run cf-typegen`.
 *
 * Configure values in `wrangler.toml`. See the full list of SDK options at
 * https://www.npmjs.com/package/@optimizely/edge-delivery
 */

import { applyExperiments, Options } from '@optimizely/edge-delivery';

interface Env {
	SNIPPET_ID: string;
	environment: 'dev' | 'prod';
	dev_host?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return await handleRequest(request, env, ctx);
	},
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
	// Configure the options passed to Optimizely Edge Delivery.
	const options: Options = {
		snippetId: env.SNIPPET_ID,
		environment: env.environment,
		// `dev_host` (and the other dev_* options) only apply when environment is 'dev'.
		dev_host: env.dev_host,

		// Other commonly used options (uncomment to use):
		// accountId: 12345678,        // required for injecting snippets from the CDN
		// position: 'top',            // 'top' | 'bottom' | '#some-element-id'
		// fallback: 'snippet',        // 'error' | 'snippet' | 'null'
		// logLevel: 'error',          // 'debug' | 'info' | 'warning' | 'error'
	};

	// Make experiment decisions from the request, apply edge changes to the control,
	// and inject any remaining browser-side work into the <head>.
	return await applyExperiments(request, ctx, options);
}
