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
    EDGE_DELIVERY_CONFIGS: KVNamespace;
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return await handleRequest(request, env, ctx);
    },
};

async function handleRequest(request: Request, env: Env, ctx: ExecutionContext) {

    // Get namespace of the KV store from parameter
    const incomingRequest = new URL(request.url);
    const kvConfig: string = incomingRequest.searchParams.get('kvConfig') || "";
    const kvNamespace: KVNamespace|undefined = kvConfig ? env[kvConfig as keyof Env] as KVNamespace : undefined;
    console.log('Using kv namespace:',kvNamespace);

    // When testing locally, the local KV store is empty to begin with.
    // Push a manifest file to the local KV store to simulate it being populated already with:
    //     kvNamespace.put(env.SNIPPET_ID, '<YOUR_MANIFEST_JSON_HERE>');
    // For example:
    kvNamespace.put(env.SNIPPET_ID, '{    "defines":{       "__ANALYTICS__":{          "OPTIMIZELY":true       },       "__CDN_HOST__":"https:",       "__GEO_CDN_HOST__":"//cdn3.optimizely.com",       "__TARGETING_CONDITIONS__":{          "BEHAVIOR":true       },       "__SEGMENTATION_FEATURES__":{          "CAMPAIGN":true,          "CURRENT_DATE":true,          "BROWSER_ID":true,          "DEVICE_TYPE":true,          "RETURNING":true,          "DEVICE":true,          "SOURCE_TYPE":true,          "REFERRER":true       },       "__VIEW_FEATURES__":{          "URL":true       },       "__VIEW_TAG_FEATURES__":{                 },       "__EVENT_FILTERS__":{                 },       "__EVENT_TYPES__":{                 },       "__LIST_TARGETING_ENDPOINT__":"https://tapi.optimizely.com/api/js/odds/project/21617700362",       "__LIVE_CHANGES__":false,       "__GROUPS__":true,       "__CHANGE__":{                 },       "__XDOMAIN__":true,       "__JQUERY_LIBRARY__":false,       "__CSP__":false,       "__RECOMMENDER__":false,       "__POLICY__":{                 },       "__ENABLE_FORCE_PARAMS__":false,       "__MIGRATE_PROJECT_DATA__":false,       "__GET_ONLY_PREVIEW_LAYERS__":true,       "__DEFAULT_REDIRECT_RELAY_MEDIUM__":"COOKIE",       "__REDIRECT_RELAY_MEDIA__":{          "COOKIE":true       },       "__UNDO_CHANGES_UPON_VIEW_DEACTIVATION__":false,       "__VIEW_TRIGGERS__":{          "IMMEDIATE":true       },       "__INNIE_JS_URI__":"https:",       "__EXPERIMENTAL_ENABLE_EET__":true,       "__CONSOLIDATE_VIEW_EVENTS__":true,       "__ODP_AUDIENCE_STICKY__":true,       "__OBSERVE_CHANGES_INDEFINITELY__":true,       "__REAPPLY_ATTRIBUTE_CHANGES__":true,       "__EXPERIMENTAL_SHADOW_DOM__":true,       "__XDOMAIN_ORIGIN__":"https://a20085117563.cdn.optimizely.com",       "__ASYNC_BASE_URL__":"https://cdn.optimizely.com/public/20085117563/data"    },    "config":{       "accountId":"20085117563",       "namespace":"21617700362",       "revision":"2087",       "anonymizeIP":true,       "enableForceParameters":false,       "experimental":{          "trimPages":true       },       "projectId":"21617700362",       "layers":[                 ],       "groups":[                 ],       "audiences":[                 ],       "listTargetingKeys":[                 ],       "visitorAttributes":[                 ],       "visitorIdLocator":null,       "integrationSettings":[                 ],       "views":[          {             "id":"30386900334",             "category":"other",             "apiName":"21617700362_adswf",             "name":"adswf",             "staticConditions":[                "and",                [                   "or",                   {                      "match":"simple",                      "type":"url",                      "value":"test"                   },                   {                      "match":"simple",                      "type":"url",                      "value":"test1"                   },                   {                      "match":"simple",                      "type":"url",                      "value":"test2"                   }                ]             ],             "deactivationEnabled":false,             "undoOnDeactivation":false,             "tags":[                             ]          }       ],       "events":[                 ],       "dimensions":[                 ],       "interestGroups":[                 ],       "tagGroups":[                 ]    },    "queue":{       "unevaluatedViews":[          "30386900334"       ],       "unevaluatedAudiences":[                 ],       "undecidedExperiences":[                 ],       "unappliedChangesets":[                 ]    },    "results":{       "activeViews":[                 ],       "inactiveViews":[                 ],       "activeAudiences":[                 ],       "inactiveAudiences":[                 ],       "activeExperiences":[                 ],       "inactiveExperiences":[                 ],       "appliedChangesets":[                 ]    } }');

    // // For debugging of whats returned from the KV retrival
    //const data = await kvNamespace.get(env.SNIPPET_ID);
    //console.log('Got raw data from KV:', data);
    //let DATA = data ? JSON.parse(data) : null;
    //console.log('Got data from KV:', DATA);

    // Configure all the options to pass to Optimizely
    const options = {
        "snippetId": env.SNIPPET_ID,
        "devUrl": env.DEV_URL,
        "kvNamespace": env.KV_NAMESPACE
    };

    // Make experiment decisions based on the request information
    // Apply those changes to the control
    // Any decisions or changes that cannot be made here are packaged together 
    // and added to the <head> element for execution on the browser 
    return await applyExperiments(request, ctx, options);
}
