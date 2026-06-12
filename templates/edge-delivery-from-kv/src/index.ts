/**
 * Optimizely Edge Delivery — "from KV" template.
 *
 * This worker reads the Edge Delivery config from a Cloudflare KV namespace instead
 * of bundling it. When `kvNamespace` is provided and `DATA` is omitted, the SDK
 * fetches the config from KV using `snippetId` as the key.
 *
 * Keeping KV up to date:
 *  - Locally (dev), the KV store starts empty, so we seed it from `seed-data.json`.
 *  - In production, set `webhookSecret` and point an Optimizely "Web SDK artifact
 *    upload" webhook at this worker's URL. The SDK automatically detects those
 *    webhook POSTs, verifies the signature, and refreshes KV — no manual seeding
 *    and no extra routing in this file. See ./README.md for the webhook setup.
 *
 * - Run `npm run dev` to start a local development server.
 * - Run `npm run deploy` to publish the worker.
 * - Regenerate `Env` types after editing bindings with `npm run cf-typegen`.
 *
 * See the full list of options at https://www.npmjs.com/package/@optimizely/edge-delivery
 */

import { applyExperiments, Options } from '@optimizely/edge-delivery';
import seedData from './seed-data.json';

interface Env {
	SNIPPET_ID: string;
	environment: 'dev' | 'prod';
	dev_host?: string;
	// KV namespace holding the Edge Delivery config, keyed by `SNIPPET_ID`.
	EDGE_DELIVERY_CONFIGS: KVNamespace;
	// Shared secret used to verify incoming Optimizely webhooks. Set it with
	// `wrangler secret put WEBHOOK_SECRET --env prod` (do NOT put it in wrangler.toml).
	WEBHOOK_SECRET?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return await handleRequest(request, env, ctx);
	},
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {
	const kvNamespace = env.EDGE_DELIVERY_CONFIGS;

	// A local KV store starts out empty. In development only, seed it once so the
	// worker has a config to read. In production the KV store is kept up to date by
	// the Optimizely webhook (see below), so we never seed there.
	if (env.environment === 'dev') {
		const existing = await kvNamespace.get(env.SNIPPET_ID);
		if (!existing) {
			await kvNamespace.put(env.SNIPPET_ID, JSON.stringify(seedData));
		}
	}

	// With `kvNamespace` set and `DATA` omitted, the SDK loads the config from KV.
	// Adding `webhookSecret` also lets the SDK handle incoming Optimizely webhook
	// POSTs and write the updated config back to the same KV namespace — this is
	// handled inside `applyExperiments`, so no extra request handling is needed here.
	const options: Options = {
		snippetId: env.SNIPPET_ID,
		environment: env.environment,
		// `dev_host` (and the other dev_* options) only apply when environment is 'dev'.
		dev_host: env.dev_host,
		kvNamespace,
		webhookSecret: env.WEBHOOK_SECRET,
	};

	// Make experiment decisions from the request, apply edge changes to the control,
	// and inject any remaining browser-side work into the <head>.
	// (Optimizely webhook POSTs are intercepted and handled here automatically.)
	return await applyExperiments(request, ctx, options);
}
