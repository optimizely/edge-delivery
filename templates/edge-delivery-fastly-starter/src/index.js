/**
 * Optimizely Edge Delivery — Fastly Compute starter template.
 *
 * - Run `npm run dev` to start a local development server.
 * - Open http://127.0.0.1:7676/ to see the service in action.
 * - Run `npm run deploy` to publish the service.
 *
 * Configure values in `fastly.toml`. See the full list of SDK options at
 * https://www.npmjs.com/package/@optimizely/edge-delivery
 */

/// <reference types="@fastly/js-compute" />
import { applyExperiments } from '@optimizely/edge-delivery-fastly';
import { ConfigStore } from 'fastly:config-store';

addEventListener('fetch', (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
	const config = new ConfigStore('edge_delivery');

	// Configure the options passed to Optimizely Edge Delivery.
	const options = {
		snippetId: config.get('SNIPPET_ID'),
		environment: config.get('environment') || 'prod',
		// `dev_host` (and the other dev_* options) only apply when environment is 'dev'.
		dev_host: config.get('dev_host') || undefined,
		// Name of the Fastly backend for the site you run experiments on (see fastly.toml).
		originBackend: 'origin',

		// Other commonly used options (uncomment to use):
		// accountId: 12345678,        // required for injecting snippets from the CDN
		// position: 'top',            // 'top' | 'bottom' | '#some-element-id'
		// fallback: 'snippet',        // 'error' | 'snippet' | 'null'
		// logLevel: 'error',          // 'debug' | 'info' | 'warning' | 'error'
		// cacheTTLs: { browserTTL: 60 }, // cache the compiled browser JS (Fastly SimpleCache)
	};

	// Make experiment decisions from the request, apply edge changes to the control,
	// and inject any remaining browser-side work into the <head>.
	// The event provides waitUntil (tracking), the visitor's geolocation and IP.
	return await applyExperiments(event.request, event, options);
}
