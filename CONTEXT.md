# ShieldAI — current implementation context

> Release context updated **14 September 2026 IST**. Canonical repository: `D:\Code\ShieldAI` (branch `redesign-glass`). Public demo: `https://shieldai-abheet19.fly.dev`; `/version` is the authoritative source-commit proof. Never infer the running deployment from repository configuration or a reachable older image. Current source and executable tests win if an older design note disagrees.
>
> This file is written to be handed to an external AI or a reader with no prior exposure to the repo: it defines every load-bearing term, walks the architecture, and ends with likely interview questions and answers.

## One-paragraph summary

ShieldAI is an educational demonstration of **Paillier partially homomorphic encryption (PHE)**. A person enters five synthetic financial figures in the browser; the browser derives four bounded integer indicators, generates a fresh 1024-bit Paillier keypair _in memory_, encrypts the indicators, and sends only the public modulus plus four ciphertexts to a Flask server. The server computes a transparent weighted sum **directly on the ciphertext** — it never has the private key and never sees a plaintext value — and returns an encrypted total. The browser decrypts that total locally, normalizes it to a 0–100 synthetic "pressure indicator", and renders it with a contribution breakdown and a privacy receipt. It is **not** AI, a trained model, a credit score, an eligibility or lending decision, or production-grade cryptography.

## Trending / load-bearing terms, explained

| Term                                                       | Plain-English meaning as used here                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Homomorphic encryption (HE)**                            | Encryption that lets you compute on ciphertext and get an encrypted result equal to computing on the plaintext. _Fully_ HE supports arbitrary add+multiply; ShieldAI uses **partial** HE.                                           |
| **Partially homomorphic (PHE)**                            | Supports one operation family. Paillier is _additively_ homomorphic: you can add two ciphertexts and multiply a ciphertext by a known plaintext constant — exactly what a linear weighted sum needs.                                |
| **Paillier cryptosystem**                                  | A 1999 public-key scheme where `Enc(a)·Enc(b) mod n² = Enc(a+b)` and `Enc(a)^k mod n² = Enc(k·a)`. Security rests on the decisional composite residuosity assumption.                                                               |
| **Public modulus `n`**                                     | The public key. Here it must be an odd 1024-bit integer; the server rebuilds a `PaillierPublicKey` from it to do the arithmetic.                                                                                                    |
| **Ciphertext**                                             | A big integer in the range `0 < c < n²`, coprime with `n`. The four encrypted indicators and the encrypted result are all ciphertexts.                                                                                              |
| **Ephemeral key**                                          | A key generated for a single use and then discarded. ShieldAI makes a new keypair per evaluation; there is no long-lived private key to persist, transmit, or rotate.                                                               |
| **Honest-but-curious (semi-honest) threat model**          | The server follows the protocol but might try to learn from what it sees. PHE defends against exactly this: the curious server sees only ciphertext. It does **not** defend against a malicious _client_ lying about its plaintext. |
| **Zero-knowledge / range proof (absent here, on purpose)** | A proof that a ciphertext encrypts a value in a valid range without revealing it. ShieldAI has none, so client-supplied ciphertexts are not proof of honest bounded inputs — a stated limitation.                                   |
| **bps (basis points)**                                     | 1 bps = 0.01%. Indicators are scaled to integer basis points because Paillier operates on integers.                                                                                                                                 |
| **Scale-to-zero cold start**                               | Fly suspends the machine when idle; the first request after idle pays a startup latency. Relevant to the reel capture and live smoke tests.                                                                                         |
| **CSP / security headers**                                 | `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` — set on every response to constrain the browser.                                                                   |

## Architecture and end-to-end flow

```text
synthetic inputs + explicit consent (browser)
  -> browser validation / indicator derivation / keygen / encryption
  -> POST { public_key:{n}, encrypted_values:{4 ciphertexts} }
  -> Flask: structure / size / range / coprimality validation
  -> homomorphic public-weight combination on ciphertext
  -> encrypted total returned
  -> browser: decrypt / normalize -> 0-100 score + contribution breakdown + receipt
  -> optional: append to browser-only localStorage history
```

Flask serves the page, `/health`, `/version`, and `POST /api/v1/private-evaluations`; it has no database and no external provider. Vendored browser Paillier code keeps all private-key operations client-side. The server computes encrypted `5·DTI-bps + 4·loan-to-income-bps + 3·utilization-bps + 200·stability-gap-months`, starting from a fresh `Enc(0)`. Request/ciphertext bounds and a process-local quota limit expensive modular arithmetic. Logs contain a request ID, route template/status, and timing — never form values, ciphertext lists, keys, or the decrypted result.

## Redesigned UI (2026-09-14 glass workspace)

The frontend is now a single-page, Flask-rendered, vanilla-JS **glass workspace** — no framework, bundler, or build step:

- **Sidebar nav** with three screens: **Overview**, **Evaluations**, **Settings**, plus a command palette (`Ctrl`/`⌘`+`K`).
- **Overview** — KPI stat tiles (local evaluation count, last result, ephemeral key model, model id), a "Recent evaluations" list, the numbered **"How ShieldAI evaluates privately"** explainer (encrypt → compute under encryption → decrypt result) with the scoring formula and a _what crosses the network vs. what stays on this device_ split, and a score-trend sparkline.
- **New evaluation drawer** — five fields, a synthetic-example button, consent, and a live encrypt→send→decrypt **stepper**; on success it shows the decrypted score banner, contribution breakdown, and privacy receipt.
- **Evaluation detail drawer** — a gauge, per-indicator contribution bars, and the privacy receipt.
- **Settings** — the per-evaluation key model, theme (light/dark/system, persisted per device), a keep-history toggle and clear-history control, and the transparent model weights.

Every number shown is computed from a real encrypted round trip; nothing is mocked. History lives only in `localStorage` on the device that ran it and can be turned off or cleared from Settings. The glass tokens (`static/vendor/glass/`) and Paillier library are vendored, so runtime design and cryptography do not depend on mutable CDN assets.

## Code map

| Path                                                       | Responsibility                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `app.py`                                                   | Routes, envelope validation, quota, homomorphic calculation, security headers, and payload-free logging                         |
| `templates/index.html`                                     | Glass workspace markup: sidebar, three screens, command palette, new-evaluation and detail drawers                              |
| `static/shield-client.js`                                  | Validation, indicator derivation, keygen, encrypt/request/decrypt/normalize, and all UI state                                   |
| `static/vendor/`                                           | Vendored Paillier implementation + license; shared glass design tokens                                                          |
| `tools/capture-reel60.mjs`                                 | Playwright + ffmpeg capture of the 60fps demo reel (`docs/media/shieldai-reel.mp4` + `shieldai-demo.gif`) against the live site |
| `tools/verify-workflows.mjs`, `tools/e2e-private-flow.mjs` | Real-browser all-CTA gate and the encrypted end-to-end assertion                                                                |
| `tools/bounded_load.py`                                    | Bounded-concurrency quota probe                                                                                                 |
| `tests/`                                                   | Backend contract tests                                                                                                          |
| `Dockerfile`, `fly.toml`, `.github/workflows/`             | Unprivileged image with baked source identity, Fly config, reusable CI, manual release                                          |

## Invariants and trust boundaries

- Raw form fields, plaintext indicators, the private key, the decrypted total, and the displayed score **never** go to the server.
- The formula, client derivation, server weights, normalization, explanation copy, and the exact `37.5/100` fixture change **atomically** — they are one contract.
- Validate request size, field set, decimal-string form/length, modulus bit-length/parity, ciphertext range, and coprimality **before** any modular arithmetic; invalid envelopes are rejected cheaply and do not consume the quota.
- Consent is explanatory UI, not a legal consent system.
- Client-generated ciphertexts are not proofs of honest bounded plaintext; the protocol has no range or zero-knowledge proof.
- Educational / synthetic / non-lending language stays adjacent to inputs and results.

## User workflows to preserve

- Populate the synthetic example, edit the five fields, exercise required/range/malformed errors, and give explicit consent.
- Run real browser keygen/encryption → Flask homomorphic arithmetic → browser decryption and verify **37.5/100** on the canonical example.
- Open the detail drawer (gauge, breakdown, receipt), trigger a bounded server/quota (429) error, retry, and verify old results clear.
- Switch theme, complete a ~320–390px mobile flow with no horizontal overflow; reload must not resurrect a plaintext result.
- Verify `/health`, `/version`, response headers/timing, payload-free logs, and process-quota behavior.

## Concepts this project teaches

| Concept                     | How it appears here                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Paillier PHE                | Ciphertexts combined for addition and public-scalar multiplication without decryption   |
| Public/private key boundary | Browser holds the private key; server needs only public modulus + ciphertexts           |
| Modular arithmetic          | Ciphertext validation and weighted exponentiation operate in the Paillier group mod n²  |
| Threat modeling             | Honest-but-curious privacy vs. malicious-client correctness vs. production security     |
| DoS bounds                  | Byte/string/count/coprimality limits and a per-client hourly quota bound expensive math |
| Privacy-safe observability  | Request IDs and Server-Timing enable debugging without logging inputs or results        |

## CI, packaging, deployment, and rollback

CI runs ESLint, Ruff, Prettier, eight backend tests, the bounded-load assertion, npm/pip dependency audits, the real browser workflow, and a production image build. Husky runs the fast lint/format/backend gate before local commits. The image embeds `GITHUB_SHA` as `SHIELDAI_SOURCE_COMMIT`; `/version` and `/health` expose it for exact-release verification. Fly is stateless with no database migration. Retain the prior verified image for rollback, then repeat the health and synthetic encrypted-flow smoke tests. (Note: the currently reachable public image reports `source_commit: unknown`; re-deploy from the reviewed commit to restore exact-release proof.)

## Likely interview questions and answers

**Q: What is homomorphic encryption and why use _partial_ HE here?**
A: HE lets you compute on ciphertext and decrypt a result equal to computing on the plaintext. Fully HE (add + multiply, arbitrary depth) is expensive; ShieldAI only needs a linear weighted sum, which is pure addition and scalar multiplication — precisely what Paillier's _additive_ PHE gives cheaply. Choosing the minimal primitive for the computation is the design point.

**Q: Concretely, what can the server do on the ciphertext?**
A: Two things. `Enc(a)·Enc(b) mod n² = Enc(a+b)` (add two encrypted numbers) and `Enc(a)^k mod n² = Enc(k·a)` (multiply an encrypted number by a public constant `k`). The weighted sum `Σ weightᵢ · indicatorᵢ` is exactly those two operations, so the whole score is computable without any decryption.

**Q: How do you know the server never sees the raw data?**
A: The endpoint's `from_payload` accepts _only_ `{public_key, encrypted_values}` and 400s on any extra or raw field, so raw values are structurally rejected. The server holds no private key — it can't decrypt. And `tools/e2e-private-flow.mjs` asserts on the wire that the outgoing request body contains only the public key and encrypted values.

**Q: What's the threat model, and what does it NOT cover?**
A: Honest-but-curious server: it follows the protocol but might try to learn from what it sees, and PHE stops that because it only ever sees ciphertext. It does _not_ cover a malicious client — there's no zero-knowledge range proof, so a client could encrypt out-of-range values; no replay binding; no authenticated origin. Those are explicitly listed as out of scope for an educational demo.

**Q: Why 1024-bit keys if that's below modern recommendations?**
A: Deliberate demo trade-off. 2048-bit Paillier keygen and encryption in-browser add noticeable latency; 1024-bit keeps the live demo responsive. It's documented as a known limitation, and the server enforces exactly 1024-bit odd moduli so the boundary is explicit rather than accidental.

**Q: How do you keep a CPU-bound crypto endpoint from being a DoS vector?**
A: Layered cheap-first checks: a 12 KB body cap (`MAX_CONTENT_LENGTH`), decimal-string and ≤700-char ciphertext limits, range and coprimality checks — all before any modular exponentiation — and a process-local budget of 8 evaluations/client/hour keyed off Fly's trusted `Fly-Client-IP`. Invalid envelopes are rejected before they can consume the quota reserved for real work.

**Q: How is observability done without leaking the very data you're protecting?**
A: Structured logs contain only method, route template, status, duration, and a per-request ID; `Server-Timing` and `X-Request-ID` are returned. No form value, ciphertext, key, IP, body, or query string is ever logged. Privacy is a logging invariant, not an afterthought.

**Q: Why derive four "indicators" instead of encrypting the five raw fields?**
A: The model is a weighted sum of ratios (debt-to-income, loan-to-income, utilization, stability gap), scaled to integer basis points because Paillier is integer-only. Deriving them client-side means the server needs only four ciphertexts and fixed public weights — the minimum information to compute the score.

**Q: How do you prove the deployed thing is the reviewed code?**
A: `/version` returns the 40-char `SHIELDAI_SOURCE_COMMIT` baked from `GITHUB_SHA` at build time. A release counts as "live" only when that commit equals the reviewed Git commit — a reachable URL alone is not proof, since an older image could still be serving.

**Q: What would you change to make this production-grade?**
A: 2048-bit+ keys, a zero-knowledge range proof for honest client inputs, authenticated origin and replay binding, a distributed rate limiter at the edge/WAF (the current quota is process-local and resets on restart), retained monitoring/alerting, an external cryptographic audit, and — since the score is synthetic — real fairness, legal, and decision-quality validation before it could ever inform a decision.

## Open limits

- 1024-bit Paillier is a timed educational choice, below modern production recommendations.
- No range proof, proof of honest derivation, malicious-client protection, replay binding, authenticated user/origin, distributed quota, or external crypto audit.
- The formula has no empirical lending, fairness, legal, or decision-quality validation.
- The process quota resets on restart and does not coordinate across machines; local timing is not device-fleet or load evidence.
- Scale-to-zero cold starts and process-local quotas remain; use `/version` to verify the running revision.

## Rules for the next coding agent

1. Never send or log plaintext, derived indicators, the private key, the decrypted total, or the displayed score.
2. Keep the project labeled educational, synthetic, non-lending, and non-AI.
3. Change formula / derivation / normalization / explanation / fixture together.
4. Do not weaken arithmetic / size / quota checks without focused negative tests.
5. Call a release live only when the public `/version` commit equals the reviewed Git commit.
