# ShieldAI study guide

## Reading order

1. Read `README.md` for the product claim and explicit non-claims.
2. Read `templates/index.html` and `static/shield-client.js` together for browser validation, derivation, key generation, encryption, and recovery states.
3. Read `app.py` for the strict request envelope, quota, ciphertext validation, and homomorphic calculation.
4. Read `tests/test_app.py` and `tools/verify-workflows.mjs` for executable backend and browser acceptance criteria.
5. Finish with `Dockerfile`, `.github/workflows/ci.yml`, `.github/workflows/fly-deploy.yml`, `fly.toml`, and `docs/TESTING.md` for the supply chain, release gate, and measured evidence.

## Explain the demo in one minute

ShieldAI demonstrates additive homomorphic encryption with a useful but deliberately synthetic affordability scenario. A browser derives four integer indicators from five form values, generates a 1024-bit Paillier key pair, encrypts each indicator, and sends a public modulus plus four ciphertext strings to Flask. The server validates a strict envelope and computes a weighted sum without a private key. The browser decrypts that returned ciphertext and displays the score. The application has no database and sends no model or LLM requests.

This is evidence of a privacy boundary in one educational protocol. It is not a lending decision, secure production underwriting system, fairness claim, zero-knowledge proof, or external cryptographic audit.

## Follow the protocol

1. The browser bounds annual income, debt, utilization, employment years, and requested amount.
2. It derives debt-to-income basis points, loan-to-income basis points, utilization basis points, and a capped stability-gap month count.
3. `paillier-bigint` creates the public/private key pair inside the tab. Only the public modulus is serialized.
4. Each derived integer is encrypted independently. The POST allowlist contains `public_key` and `encrypted_values` only.
5. Flask verifies exact field names, a 1024-bit odd modulus, decimal ciphertext lengths, range below `n²`, and coprimality with `n`.
6. Python `phe` adds ciphertexts and multiplies them by public integer weights. It never decrypts.
7. The browser validates the response envelope, decrypts the total, divides by the published normalization value, and labels the result as synthetic.

## The arithmetic

The evaluator computes:

```text
5 × debt_to_income_bps
+ 4 × loan_to_income_bps
+ 3 × utilization_bps
+ 200 × stability_gap_months
```

For the built-in synthetic example—85,000 income, 12,000 debt, 30% utilization, five employment years, and a 20,000 request—the rounded encrypted calculation decrypts to **37.5/100**. That number demonstrates correctness of the protocol and formula. It has no learned statistical meaning.

## Why Paillier works here

Paillier supports addition of encrypted values and multiplication of an encrypted value by a plaintext scalar. Those are exactly the operations in a linear weighted sum. It does not support arbitrary encrypted comparisons or branches, so the server cannot choose a score band without additional protocols. The browser assigns the explanatory band after local decryption.

## Threat boundary

| Protected in this demo | Still exposed or unproved |
|---|---|
| Raw form values are absent from the evaluator request | Network metadata and timing remain visible |
| Private key stays in browser memory | A compromised server could ship malicious browser JavaScript |
| Server stores no application data | Reverse proxies/platform logs need separate review |
| Strict JSON allowlist rejects accidental raw fields | Server cannot prove ciphertext plaintexts came from the displayed ranges |
| CSP blocks third-party scripts and framing | 1024-bit parameters are for demo performance, not production strength |
| Request size and process-local budget bound basic CPU use | Multi-machine quotas and sustained denial-of-service protection require an edge control |

## Runtime, types, and lifecycle

The client is standards-based JavaScript and the evaluator is Python/Flask; the project does not use or claim a TypeScript build. Browser values, response JSON, and ciphertext strings are checked at runtime because compile-time types cannot validate network data. The in-memory private key exists only inside one submit-handler call and becomes unreachable after the result or error path completes; reload also clears the plaintext result.

The server uses an application factory for isolated tests, a dataclass-style validated request object, a lock-protected sliding-window quota, exact JSON allowlists, bounded integer/string checks, and pure encrypted arithmetic. Invalid envelopes are rejected before they consume the CPU-work quota. HTTP 413 is normalized to JSON so every evaluator failure follows the same client contract.

## CI, deployment, and evidence

CI installs pinned Python and Node tooling, audits the runtime dependency sets, runs seven backend tests, starts the real Flask evaluator, drives the ten-group portable-Chromium flow, and builds the production container. The manual Fly workflow reuses that CI job before deployment. Fly runs one unprivileged Gunicorn process with four threads, HTTPS routing, a health check, and scale-to-zero. `docs/TESTING.md` is the canonical testing artifact; browser JSON and screenshots support it, while the README GIF communicates the flow. Payload-free JSON request events go to the Flask/Gunicorn logs, and `X-Request-ID` plus `Server-Timing` connect an observed response to its route, status, and duration without logging private material.

## Questions a reviewer may ask

**Is this fully homomorphic encryption?** No. Paillier is partially homomorphic: it supports encrypted addition and plaintext-scalar multiplication.

**Why derive indicators before encryption?** Division is not directly available in this Paillier workflow. The browser converts ratios into bounded integers first so the evaluator only needs supported linear operations.

**Can the server validate the hidden values?** No. Envelope checks validate ciphertext structure, not hidden plaintext ranges. A production protocol would need range proofs or a trusted/signed client boundary.

**Why no machine-learning model?** The transparent formula makes the encrypted computation inspectable and avoids presenting a toy trained model as lending intelligence. The old CSV/regression files are historical, their packages are isolated in `requirements-legacy.txt`, and neither the files nor those packages are copied into the runtime image or used by `app.py`.

**What would production work require?** Reviewed parameters and protocol, 2048-bit performance tests, threat modeling, signed assets, input proofs, edge rate limits, privacy-safe observability, authentication where appropriate, governance and fairness work, and legal review.

## Failure drills

- Malformed or extra fields: return JSON 400 before consuming evaluation quota.
- Request over 12 KB: return JSON 413 without evaluator work.
- Valid client exceeds the local budget: return 429 with `Retry-After`; clear any stale UI result.
- Evaluator times out or returns malformed JSON: show a recoverable browser error and discard the in-memory key when the function exits.
- Deployment regression: restore the last verified image, recheck `/health`, and run the synthetic browser flow without recording form payloads.
