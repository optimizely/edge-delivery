/**
 * Optimizely Edge Delivery — Fastly Compute "from KV" template.
 *
 * This service reads the Edge Delivery config from a Fastly KV Store instead of the
 * Optimizely CDN. When `kvNamespace` is provided and `DATA` is omitted, the SDK loads
 * the config from KV using `snippetId` as the key. If the key is missing, it falls back
 * to the CDN.
 *
 * Keeping KV up to date:
 *  - Locally, `fastly.toml` seeds the KV Store from `src/seed-data.json`.
 *  - In production, point an Optimizely "Web SDK artifact upload" webhook at this
 *    service's URL and store its secret as WEBHOOK_SECRET in the Secret Store. The SDK
 *    detects those webhook POSTs, verifies the signature, and writes the new config to
 *    KV. No extra routing is needed in this file. See ./README.md.
 *
 * - Run `npm run dev` to start a local development server.
 * - Run `npm run deploy` to publish the service.
 *
 * Configure values in `fastly.toml`. See the full list of SDK options at
 * https://www.npmjs.com/package/@optimizely/edge-delivery
 */

/// <reference types="@fastly/js-compute" />
import { applyExperiments, kvStoreAdapter } from '@optimizely/edge-delivery-fastly';
import { ConfigStore } from 'fastly:config-store';
import { KVStore } from 'fastly:kv-store';
import { SecretStore } from 'fastly:secret-store';

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
	const config = new ConfigStore('edge_delivery');

	// With `kvNamespace` set and `DATA` omitted, the SDK loads the config from KV.
	// `webhookSecret` also lets the SDK handle incoming Optimizely webhook POSTs and
	// write the updated config back to the same KV Store, inside `applyExperiments`.
	const options = {
		snippetId: config.get('SNIPPET_ID'),
		environment: config.get('environment') || 'prod',
		// `dev_host` (and the other dev_* options) only apply when environment is 'dev'.
		dev_host: config.get('dev_host') || undefined,
		// Name of the Fastly backend for the site you run experiments on (see fastly.toml).
		originBackend: 'origin',
		kvNamespace: kvStoreAdapter(new KVStore('edge_delivery_configs')),
		webhookSecret: await getWebhookSecret(),
	};

	// Make experiment decisions from the request, apply edge changes to the control,
	// and inject any remaining browser-side work into the <head>.
	// (Optimizely webhook POSTs are intercepted and handled here automatically.)
	return await applyExperiments(event.request, event, options);
}

// The webhook is optional: pages keep working if the Secret Store or secret is missing.
async function getWebhookSecret() {
	try {
		const secret = await new SecretStore('edge_delivery_secrets').get('WEBHOOK_SECRET');
		return secret?.plaintext();
	} catch {
		return undefined;
	}
}
