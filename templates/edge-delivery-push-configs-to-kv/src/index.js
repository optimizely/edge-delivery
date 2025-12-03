import CryptoJS from 'crypto-js';

/**
 * Verify webhook signature using HMAC-SHA1
 * @param {string} payload - The raw request body as string
 * @param {string} signature - The signature from X-Hub-Signature header
 * @param {string} secret - The webhook secret
 * @returns {boolean} - True if signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
	if (!signature || !signature.startsWith('sha1=')) {
		return false;
	}

	const receivedDigest = signature.substring(5);
	const computedDigest = CryptoJS.HmacSHA1(payload, secret).toString();

	return receivedDigest === computedDigest;
}

export default {
	async fetch(request, env, ctx) {
		// handle a POST request to update KV
		if (request.method === 'POST') {
			try {
				// Read raw body for signature verification
				const rawBody = await request.text();

				// Verify webhook signature - ALWAYS required
				if (!env.OPTIMIZELY_WEBHOOK_SECRET) {
					console.error('OPTIMIZELY_WEBHOOK_SECRET not configured');
					return new Response('Server configuration error', { status: 500 });
				}

				const signature = request.headers.get('X-Hub-Signature');
				console.log('Received signature:', signature);

				const isValid = verifyWebhookSignature(rawBody, signature, env.OPTIMIZELY_WEBHOOK_SECRET);

				if (!isValid) {
					console.log('Invalid webhook signature');
					return new Response('Invalid signature', { status: 401 });
				}
				console.log('Webhook signature verified successfully');

				// Parse the JSON body
				const payload = JSON.parse(rawBody);
				console.log('Request body:', payload);
				console.log('Request headers:', [...request.headers]);

				const key = String(payload.project_id);
				const value = JSON.stringify(payload.data);
				console.log(`Received key: ${key}, value: ${value}`);

				if (!key || !value) {
					return new Response('Missing key or value in request body', { status: 400 });
				}
				await env.KV_NAMESPACE.put(key, value);
				return new Response(`Successfully updated key: ${key}`, { status: 200 });
			} catch (error) {
				console.error('Error processing request:', error);
				return new Response('Invalid JSON body', { status: 400 });
			}
		}

		// For other request methods, return a simple message
		return new Response('Send a POST request with JSON body containing "key" and "value" to update KV.', {
			status: 405,
		});
	},
};
