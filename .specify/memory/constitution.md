<!-- Constitution: v0.0.1 | Created: 2026-04-30 -->

# Edge Delivery Constitution

This constitution governs development for **edge-delivery**, a Cloudflare Workers-based
edge experiment delivery service in the Optimizely Experimentation platform. Edge Delivery
uses HTMLRewriter to modify customer page DOM at the edge, delivering A/B test variations
without requiring client-side JavaScript execution for initial rendering.

## Core Principles

### I. Edge Performance First

Edge Delivery runs as a Cloudflare Worker on every request to participating customer pages.
Performance is existential -- degradation directly impacts customer site speed and revenue.

- Cold start time MUST remain under 5ms. Worker bundle size MUST be minimized.
- Total Worker execution time per request SHOULD remain under 50ms (p99).
- All KV reads MUST be non-blocking where possible. Batch KV lookups when feasible.
- Memory usage MUST stay within Cloudflare Workers limits (128MB). Avoid allocating
  large intermediate objects during HTMLRewriter transformations.
- CPU time MUST stay within Cloudflare Workers limits (10ms on free, 50ms on paid).
  Avoid synchronous heavy computation; prefer streaming transforms.
- Bundle size SHOULD be monitored in CI. Any increase above 10% requires justification.

### II. HTMLRewriter Safety

DOM modifications via HTMLRewriter are the core function of this service. A malformed
transformation can break customer pages in production with zero rollback time.

- HTMLRewriter element handlers MUST NOT remove or replace elements that could break
  page structure (e.g., `<html>`, `<head>`, `<body>`, `<script>` tags not owned by us).
- All DOM mutations MUST be scoped to elements explicitly targeted by experiment
  configuration. Never apply broad selectors (e.g., `div`, `*`, `body > *`).
- HTMLRewriter transformations MUST be idempotent -- applying the same variation twice
  MUST produce the same result as applying it once.
- If HTMLRewriter encounters an error during transformation, the service MUST fail open:
  serve the original unmodified page rather than an error page or partial content.
- New HTMLRewriter handler types MUST include integration tests that verify the output
  HTML is valid and the original page structure is preserved.

### III. Datafile Consumption & Bucketing Correctness

Edge Delivery reads experiment configuration (datafiles) from Cloudflare KV, populated
by datafile-build-service. Bucketing decisions at the edge determine which variation
a visitor sees.

- Datafile reads from KV MUST handle missing keys gracefully (serve original page).
- Stale datafile detection SHOULD be implemented. If a datafile's timestamp exceeds
  a configured threshold, log a warning but continue serving (do not block).
- Bucketing logic MUST produce deterministic results for the same visitor + experiment
  combination. The same user MUST see the same variation across page loads.
- Bucketing MUST match the canonical SDK bucketing algorithm to ensure consistency
  between edge-delivered and client-side experiments.
- Traffic allocation percentages MUST be respected precisely. Rounding errors in
  bucketing MUST NOT cause systematic bias toward any variation.

### IV. Evidence-Based Development

All changes MUST be verified against connected services. Edge Delivery operates at the
boundary between Optimizely infrastructure and customer pages -- changes have blast
radius beyond our systems.

- Changes to HTMLRewriter handlers MUST be tested against representative customer
  page structures (not just synthetic HTML).
- Changes to KV read patterns MUST be validated against datafile-build-service output
  format. Breaking changes to the KV schema require coordinated deployment.
- Changes to bucketing logic MUST include parity tests against the canonical
  javascript-sdk bucketing implementation.
- Performance changes MUST include before/after benchmarks with realistic payload sizes.

### V. Code Quality (TypeScript)

Edge Delivery is written in TypeScript targeting the Cloudflare Workers runtime.

- All code MUST be written in TypeScript with strict mode enabled (`strict: true`).
- No `any` types except at Cloudflare API boundaries where types are unavailable.
  Use `unknown` with type guards instead.
- All exported functions MUST have JSDoc documentation including parameter descriptions.
- Dependencies MUST be minimal. Every npm dependency increases bundle size and attack
  surface. New dependencies require explicit justification.
- Cloudflare Workers-incompatible Node.js APIs (e.g., `fs`, `net`, `child_process`)
  MUST NOT be imported. Use Workers-compatible alternatives.

### VI. Spec-Driven Development

All roadmap work follows the spec-driven standard. Specs commit alongside code.

- Every feature or significant change MUST have a spec in `.specify/specs/` before
  implementation begins.
- Specs MUST describe the expected behavior at the edge (request flow, KV interactions,
  HTMLRewriter transformations, bucketing decisions).
- Specs MUST identify which connected services are affected and what coordination
  is required.
- Implementation PRs MUST reference their spec. Spec and code changes commit together.

### VII. Error Resilience & Observability

Edge Delivery is a transparent proxy -- customers do not know it exists. Failures
MUST be invisible to end users.

- The service MUST fail open on all error paths. If any step fails (KV read, datafile
  parse, bucketing, HTMLRewriter), serve the original page unmodified.
- All error paths MUST emit structured logs with: request URL, experiment ID (if known),
  error type, and Worker execution time.
- KV read failures MUST be distinguished from KV key-not-found (the latter is normal
  for non-participating pages).
- Request timeout handling MUST ensure the Worker does not hang indefinitely. Use
  Cloudflare's built-in timeout mechanisms.

## Connected Services

| Service | Direction | Data Flow | Protocol |
|---|---|---|---|
| datafile-build-service | Upstream | Builds datafiles from flags + monolith data, writes to S3 + Cloudflare KV | Cloudflare KV (read) |
| optimizely (monolith) | Upstream | Experiment configuration source (via Pub/Sub to flags to datafile-build-service) | Indirect (via datafile) |
| Cloudflare KV | Data Store | Stores experiment datafiles; edge-delivery reads on each request | KV API |
| Customer browsers | Downstream | Receives modified HTML with experiment variations applied | HTTP response (HTMLRewriter) |
| client-js | Peer | Runs alongside in browser; edge-delivery handles initial render, client-js handles dynamic interactions | Shared datafile format |
| edge-injector | Peer | Both are Cloudflare Workers that can modify the same customer page. edge-injector injects the snippet, edge-delivery applies experiment variations via HTMLRewriter. They may operate in sequence on the same response. | Cloudflare Workers (same request pipeline) |
| edge-services | Peer | Edge experiment bucketing and microsnippet delivery service. Operates alongside edge-delivery in the edge delivery pipeline. | Cloudflare Workers |
| javascript-sdk | Reference | Canonical bucketing algorithm; edge-delivery bucketing MUST match | Algorithm parity (no runtime dependency) |

## Known System Behaviors

1. **Datafile freshness depends on datafile-build-service pipeline** -- if Pub/Sub delivery
   from flags is delayed, KV datafiles may be stale. Edge Delivery has no mechanism to
   force a datafile rebuild.
2. **Cloudflare KV is eventually consistent** -- writes from datafile-build-service may
   take up to 60 seconds to propagate to all edge locations. During this window,
   different edge locations may serve different experiment configurations.
3. **HTMLRewriter is streaming** -- it processes HTML as a stream, not a DOM tree.
   You cannot "look ahead" or access elements that haven't been streamed yet.
   Transformations must work with partial document context.
4. **Worker CPU limits are per-request** -- 10ms (free) or 50ms (paid) of CPU time.
   This is wall-clock CPU, not elapsed time. Waiting on KV reads does not count.
5. **edge-delivery + edge-injector coexistence** -- Both Workers may operate on the
   same customer response in sequence. edge-injector injects the Optimizely snippet
   into the `<head>`, and edge-delivery applies experiment variation changes via
   HTMLRewriter. Changes to either Worker's HTML manipulation must consider the
   other's presence: edge-delivery's HTMLRewriter transforms should not interfere
   with the injected snippet, and edge-injector should not duplicate-detect
   edge-delivery's modifications as existing snippets.

## Governance

**Version**: 0.0.1 | **Ratified**: 2026-04-30 | **Last Amended**: 2026-04-30

Changes to this constitution require team review and a version bump.
Amendments are tracked via git history on this file.
