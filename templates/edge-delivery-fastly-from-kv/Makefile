# Fastly Compute helpers for the Edge Delivery "from KV" template. Run `make help`.
# Service setup is covered in ../edge-delivery-fastly-starter/SETUP.md; KV and webhook setup in README.md.
#
# Targets that change the service edit the latest version, cloning it first if it is
# already active (--autoclone). Run `make activate` afterwards to put the changes live.

FASTLY       := npx fastly
CONFIG_STORE := edge_delivery
KV_STORE     := edge_delivery_configs
SECRET_STORE := edge_delivery_secrets
SERVICE_NAME ?= edge-delivery-fastly-from-kv
# Written to fastly.toml by the first `make deploy`. Override with `make <target> SERVICE_ID=...`.
SERVICE_ID   ?= $(shell sed -n 's/^service_id = "\(.*\)"/\1/p' fastly.toml)
SVC           = --service-id $(SERVICE_ID)
FILE         ?= src/seed-data.json

# $(call store_id,<config-store|kv-store|secret-store>,<name>): looked up when the recipe runs.
# `list --json` returns an array (config stores), {data: [...]} (KV, secrets) or null (none yet).
store_id = $$($(FASTLY) $(1) list --json | node -e 'let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => { const j = JSON.parse(s || "null"); const list = Array.isArray(j) ? j : (j?.data ?? []); process.stdout.write(list.find(x => x.name === process.argv[1])?.id ?? ""); })' $(2))

.PHONY: help npm-auth install build serve login whoami deploy activate versions logs \
	create-service backend backends domain domains config-store config-set config-list \
	kv-store kv-put kv-get kv-list secret-store secret-set webhook-test

help: ## List targets
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- Local development -------------------------------------------------------

npm-auth: ## Authenticate npm to GitHub Packages for @optimizely/* (uses the gh CLI token)
	npm config set @optimizely:registry https://npm.pkg.github.com
	npm config set //npm.pkg.github.com/:_authToken $$(gh auth token)

install: ## Install dependencies
	npm install

build: ## Compile src/index.js -> bin/main.wasm
	npm run build

serve: ## Run locally on http://127.0.0.1:7676 (KV seeded from src/seed-data.json)
	$(FASTLY) compute serve

# --- Fastly account ----------------------------------------------------------

login: ## Store a Fastly API token for the CLI
	$(FASTLY) auth login

whoami: ## Show the authenticated Fastly user
	$(FASTLY) whoami

# --- Deploy ------------------------------------------------------------------

deploy: ## Build and publish. The first run creates the service, backend and stores from [setup]
	$(FASTLY) compute publish $(if $(SERVICE_ID),$(SVC))

activate: ## Activate a version: make activate [VERSION=<n>] (default: latest)
	$(FASTLY) service version activate $(SVC) --version $(or $(VERSION),latest)

versions: ## List service versions
	$(FASTLY) service version list $(SVC)

logs: ## Tail live production logs (console output)
	$(FASTLY) log-tail $(SVC)

# --- Service configuration (manual setup, or changes after the first deploy) -

create-service: ## Create an empty Compute service: make create-service [SERVICE_NAME=...]
	$(FASTLY) service create --type wasm --name $(SERVICE_NAME)
	@echo "Add the printed ID to fastly.toml as: service_id = \"<id>\""

backend: ## Add a TLS origin backend: make backend ORIGIN=<host> [NAME=origin]
	@test -n "$(ORIGIN)" || { echo "usage: make backend ORIGIN=<host> [NAME=origin]"; exit 1; }
	$(FASTLY) service backend create $(SVC) --version latest --autoclone \
		--name $(or $(NAME),origin) --address $(ORIGIN) --port 443 \
		--use-ssl --ssl-sni-hostname $(ORIGIN) --ssl-cert-hostname $(ORIGIN)

backends: ## List backends on the active version
	$(FASTLY) service backend list $(SVC) --version active

domain: ## Add a domain: make domain DOMAIN=www.example.com
	@test -n "$(DOMAIN)" || { echo "usage: make domain DOMAIN=<host>"; exit 1; }
	$(FASTLY) service domain create $(SVC) --version latest --autoclone --name $(DOMAIN)

domains: ## List domains on the active version
	$(FASTLY) service domain list $(SVC) --version active

config-store: ## Create the edge_delivery config store and link it to the service
	$(FASTLY) config-store create --name $(CONFIG_STORE)
	$(FASTLY) service resource-link create $(SVC) --version latest --autoclone --resource-id $(call store_id,config-store,$(CONFIG_STORE))

config-set: ## Set a config value (live, no activation needed): make config-set KEY=SNIPPET_ID VALUE=123
	@test -n "$(KEY)" -a -n "$(VALUE)" || { echo "usage: make config-set KEY=<key> VALUE=<value>"; exit 1; }
	$(FASTLY) config-store-entry update --upsert --store-id $(call store_id,config-store,$(CONFIG_STORE)) --key $(KEY) --value $(VALUE)

config-list: ## List config values
	$(FASTLY) config-store-entry list --store-id $(call store_id,config-store,$(CONFIG_STORE))

# --- KV Store (Edge Delivery config) -----------------------------------------

kv-store: ## Create the edge_delivery_configs KV Store and link it to the service
	$(FASTLY) kv-store create --name $(KV_STORE)
	$(FASTLY) service resource-link create $(SVC) --version latest --autoclone --resource-id $(call store_id,kv-store,$(KV_STORE))

kv-put: ## Upload a config to KV: make kv-put SNIPPET_ID=<id> [FILE=src/seed-data.json]
	@test -n "$(SNIPPET_ID)" || { echo "usage: make kv-put SNIPPET_ID=<id> [FILE=<path>]"; exit 1; }
	$(FASTLY) kv-store-entry create --store-id $(call store_id,kv-store,$(KV_STORE)) --key $(SNIPPET_ID) --value "$$(cat $(FILE))"

kv-get: ## Show the config stored in KV: make kv-get SNIPPET_ID=<id>
	@test -n "$(SNIPPET_ID)" || { echo "usage: make kv-get SNIPPET_ID=<id>"; exit 1; }
	$(FASTLY) kv-store-entry describe --store-id $(call store_id,kv-store,$(KV_STORE)) --key $(SNIPPET_ID)

kv-list: ## List keys in the KV Store
	$(FASTLY) kv-store-entry list --store-id $(call store_id,kv-store,$(KV_STORE))

# --- Secret Store (webhook secret) -------------------------------------------

secret-store: ## Create the edge_delivery_secrets Secret Store and link it to the service
	$(FASTLY) secret-store create --name $(SECRET_STORE)
	$(FASTLY) service resource-link create $(SVC) --version latest --autoclone --resource-id $(call store_id,secret-store,$(SECRET_STORE))

secret-set: ## Set WEBHOOK_SECRET (prompts for the value copied from Optimizely)
	$(FASTLY) secret-store-entry create --store-id $(call store_id,secret-store,$(SECRET_STORE)) --name WEBHOOK_SECRET --recreate-allow

webhook-test: ## POST a signed webhook: make webhook-test [URL=http://127.0.0.1:7676/] [SECRET=local-webhook-secret] [FILE=...]
	@node -e ' \
		const { readFileSync } = require("fs"); \
		const { createHmac } = require("crypto"); \
		const [url, secret, file] = process.argv.slice(1); \
		const body = JSON.stringify({ event: "project.web_sdk_artifact_upload", project_id: 0, timestamp: Date.now(), data: JSON.parse(readFileSync(file, "utf8")) }); \
		const signature = "sha1=" + createHmac("sha1", secret).update(body).digest("hex"); \
		fetch(url, { method: "POST", body, headers: { "content-type": "application/json", "X-Optimizely-Event-Type": "WebSDKArtifactUpload", "X-Hub-Signature": signature } }) \
			.then(async r => console.log(r.status, await r.text())); \
	' $(or $(URL),http://127.0.0.1:7676/) $(or $(SECRET),local-webhook-secret) $(FILE)
