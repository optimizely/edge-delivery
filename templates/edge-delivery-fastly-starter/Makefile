# Fastly Compute helpers for the Edge Delivery starter. Run `make help`.
# See SETUP.md for the full walkthrough.
#
# Targets that change the service edit the latest version, cloning it first if it is
# already active (--autoclone). Run `make activate` afterwards to put the changes live.

FASTLY       := npx fastly
STORE_NAME   := edge_delivery
SERVICE_NAME ?= edge-delivery-fastly-starter
# Written to fastly.toml by the first `make deploy`. Override with `make <target> SERVICE_ID=...`.
SERVICE_ID   ?= $(shell sed -n 's/^service_id = "\(.*\)"/\1/p' fastly.toml)
SVC           = --service-id $(SERVICE_ID)
# Looked up when a recipe runs, so it works right after `make config-store` creates the store.
STORE_ID      = $$($(FASTLY) config-store list --json | node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).find(s => s.name === "$(STORE_NAME)")?.id ?? ""')

.PHONY: help npm-auth install build serve login whoami deploy activate versions logs \
	create-service backend backends domain domains config-store config-set config-list

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

serve: ## Run locally on http://127.0.0.1:7676 (uses [local_server] in fastly.toml)
	$(FASTLY) compute serve

# --- Fastly account ----------------------------------------------------------

login: ## Store a Fastly API token for the CLI
	$(FASTLY) auth login

whoami: ## Show the authenticated Fastly user
	$(FASTLY) whoami

# --- Deploy ------------------------------------------------------------------

deploy: ## Build and publish. The first run creates the service, origin backend and config store from [setup]
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
	$(FASTLY) config-store create --name $(STORE_NAME)
	$(FASTLY) service resource-link create $(SVC) --version latest --autoclone --resource-id $(STORE_ID)

config-set: ## Set a config value (live, no activation needed): make config-set KEY=SNIPPET_ID VALUE=123
	@test -n "$(KEY)" -a -n "$(VALUE)" || { echo "usage: make config-set KEY=<key> VALUE=<value>"; exit 1; }
	$(FASTLY) config-store-entry update --upsert --store-id $(STORE_ID) --key $(KEY) --value $(VALUE)

config-list: ## List config values
	$(FASTLY) config-store-entry list --store-id $(STORE_ID)
